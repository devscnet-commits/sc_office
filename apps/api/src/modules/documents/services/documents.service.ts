import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { MinioService } from '../../../infrastructure/minio/minio.service';
import { TemplateEngineService } from '../../templates/engines/template-engine.service';
import { EmployeesService } from '../../employees/services/employees.service';
import { AuditService } from '../../audit/audit.service';
import { ComplianceService } from '../../compliance/services/compliance.service';
import { CustomFieldsService } from '../../custom-fields/services/custom-fields.service';
import { TemplateFormat, DocumentStatus } from '@prisma/client';

export interface GenerateDocumentDto {
  templateId: string;
  employeeId: string;
  name?: string;
  dossierFolderId?: string;
  additionalVariables?: Record<string, string>;
  notes?: string;
  /** If true, skips compliance blocking (ADMIN override) */
  forceGenerate?: boolean;
}

export interface PreviewDocumentDto {
  templateId: string;
  employeeId: string;
  additionalVariables?: Record<string, string>;
}

export interface PreviewResult {
  html: string;
  variables: Record<string, string>;
  compliance: {
    canGenerate: boolean;
    requirements: any[];
    blockerCount: number;
  };
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly engine: TemplateEngineService,
    private readonly employeesService: EmployeesService,
    private readonly audit: AuditService,
    private readonly compliance: ComplianceService,
    private readonly customFields: CustomFieldsService,
    @InjectQueue('pdf-generation') private readonly pdfQueue: Queue,
  ) {}

  // ============================================================
  // BUILD ALL VARIABLES (employee + company + date + custom + calculated)
  // ============================================================

  private async buildVariables(
    employeeId: string,
    additionalVariables?: Record<string, string>,
  ): Promise<Record<string, string>> {
    const [employeeVars, customVars] = await Promise.all([
      this.employeesService.getVariables(employeeId),
      this.customFields.buildVariablesMap(employeeId),
    ]);

    const company = await this.prisma.company.findFirst();
    const companyVars: Record<string, string> = company
      ? {
          'empresa.nome': company.name,
          'empresa.nome_fantasia': company.tradeName || company.name,
          'empresa.cnpj': company.cnpj,
          'empresa.endereco': `${company.street || ''}, ${company.number || ''}`.trim(),
          'empresa.cidade': company.city || '',
          'empresa.estado': company.state || '',
          'empresa.cep': company.zipCode || '',
          'empresa.telefone': company.phone || '',
          'empresa.email': company.email || '',
        }
      : {};

    const now = new Date();
    const dateVars: Record<string, string> = {
      'data.hoje': now.toLocaleDateString('pt-BR'),
      'data.hoje_extenso': now.toLocaleDateString('pt-BR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      }),
      'data.ano': now.getFullYear().toString(),
      'data.mes': (now.getMonth() + 1).toString().padStart(2, '0'),
      'data.dia': now.getDate().toString().padStart(2, '0'),
    };

    const baseVars = { ...employeeVars, ...companyVars, ...dateVars, ...customVars, ...(additionalVariables || {}) };
    const calculatedVars = this.engine.computeCalculatedVariables(baseVars);

    return { ...baseVars, ...calculatedVars };
  }

  // ============================================================
  // PREVIEW (no persistence, compliance check included)
  // ============================================================

  async preview(dto: PreviewDocumentDto, userId: string): Promise<PreviewResult> {
    const template = await this.prisma.template.findUnique({
      where: { id: dto.templateId },
      include: { fileStorage: true },
    });
    if (!template) throw new NotFoundException('Template não encontrado');

    const [allVariables, complianceCheck] = await Promise.all([
      this.buildVariables(dto.employeeId, dto.additionalVariables),
      this.compliance.checkCompliance(dto.templateId, dto.employeeId),
    ]);

    let html: string;

    if (template.format === TemplateFormat.HTML) {
      html = this.engine.renderHtml(template.htmlContent!, allVariables);
    } else {
      html = this.buildDocxPreviewHtml(allVariables, template.variables as any[]);
    }

    await this.audit.log({
      userId,
      action: 'PREVIEW_DOCUMENT',
      module: 'documents',
      entityType: 'template',
      entityId: dto.templateId,
      newValues: { employeeId: dto.employeeId },
    });

    return {
      html,
      variables: allVariables,
      compliance: {
        canGenerate: complianceCheck.canGenerate,
        requirements: complianceCheck.requirements,
        blockerCount: complianceCheck.blockerCount,
      },
    };
  }

  // ============================================================
  // GENERATE
  // ============================================================

  async generate(dto: GenerateDocumentDto, userId: string) {
    const template = await this.prisma.template.findUnique({
      where: { id: dto.templateId },
      include: { fileStorage: true },
    });
    if (!template) throw new NotFoundException('Template não encontrado');

    // Compliance check BEFORE generating
    const complianceCheck = await this.compliance.checkCompliance(
      dto.templateId,
      dto.employeeId,
    );

    if (!complianceCheck.canGenerate && !dto.forceGenerate) {
      throw new UnprocessableEntityException({
        message: 'Não é possível gerar o documento: documentos obrigatórios ausentes ou vencidos',
        compliance: complianceCheck,
      });
    }

    const allVariables = await this.buildVariables(dto.employeeId, dto.additionalVariables);

    // Build employee snapshot — null-safe (position/department may not be set)
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      include: {
        department: { select: { name: true } },
        position: { select: { title: true } },
      },
    });
    if (!employee) throw new NotFoundException('Funcionário não encontrado');

    const employeeSnapshot = {
      id: employee.id,
      fullName: employee.fullName,
      cpf: employee.cpf,
      matricula: employee.matricula,
      position: employee.position?.title ?? '',
      department: employee.department?.name ?? '',
      admissionDate: employee.admissionDate,
      snapshotAt: new Date().toISOString(),
    };

    // Generate document buffer
    let generatedBuffer: Buffer;
    let mimeType: string;
    let extension: string;

    if (template.format === TemplateFormat.DOCX) {
      if (!template.fileStorage) {
        throw new BadRequestException('Template DOCX não possui arquivo');
      }
      const templateBuffer = await this.minio.getObject(
        template.fileStorage.bucket,
        template.fileStorage.key,
      );
      generatedBuffer = await this.engine.renderDocx(templateBuffer, allVariables);
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      extension = 'docx';
    } else {
      const html = this.engine.renderHtml(template.htmlContent!, allVariables);
      generatedBuffer = Buffer.from(html, 'utf-8');
      mimeType = 'text/html';
      extension = 'html';
    }

    const docName = dto.name || `${template.name} - ${employee.fullName} - ${new Date().toLocaleDateString('pt-BR')}`;

    // Upload generated document to MinIO
    const uploadResult = await this.minio.uploadFile(
      this.minio.getBucketName('documents'),
      generatedBuffer,
      `${docName}.${extension}`,
      mimeType,
      `documents/${dto.employeeId}`,
    );

    const fileStorage = await this.prisma.fileStorage.create({
      data: {
        bucket: uploadResult.bucket,
        key: uploadResult.key,
        originalName: `${docName}.${extension}`,
        mimeType,
        size: BigInt(generatedBuffer.length),
        checksum: uploadResult.etag,
        uploadedBy: userId,
      },
    });

    // Pin to current template version
    const currentVersion = await this.prisma.templateVersion.findFirst({
      where: { templateId: dto.templateId },
      orderBy: { version: 'desc' },
    });

    // Auto-resolve dossier folder: use provided or find "Contratos" system folder
    let resolvedDossierFolderId = dto.dossierFolderId;
    if (!resolvedDossierFolderId) {
      const contratosFolder = await this.prisma.dossierFolder.findFirst({
        where: { employeeId: dto.employeeId, name: 'Contratos', isSystem: true },
      });
      resolvedDossierFolderId = contratosFolder?.id;
    }

    const document = await this.prisma.generatedDocument.create({
      data: {
        name: docName,
        templateId: dto.templateId,
        templateVersionId: currentVersion?.id,
        employeeId: dto.employeeId,
        status: DocumentStatus.GENERATED,
        variables: allVariables as any,
        employeeSnapshot: employeeSnapshot as any,
        fileStorageId: fileStorage.id,
        dossierFolderId: resolvedDossierFolderId,
        createdBy: userId,
        notes: dto.notes,
      },
      include: {
        template: { select: { id: true, name: true, format: true } },
        employee: { select: { id: true, fullName: true, matricula: true } },
      },
    });

    // Update template usage count
    await this.prisma.template.update({
      where: { id: dto.templateId },
      data: { usageCount: { increment: 1 } },
    });

    // Queue PDF generation — non-blocking so a Redis issue doesn't fail the generation
    try {
      await this.pdfQueue.add('generate-pdf', {
        documentId: document.id,
        format: template.format,
        fileStorageId: fileStorage.id,
        userId,
      });
    } catch (err) {
      this.logger.warn(`PDF queue unavailable — document generated but PDF not queued: ${(err as Error).message}`);
    }

    await this.audit.log({
      userId,
      action: 'GENERATE_DOCUMENT',
      module: 'documents',
      entityType: 'generated_document',
      entityId: document.id,
      newValues: {
        name: docName,
        employeeId: dto.employeeId,
        templateId: dto.templateId,
        complianceOverride: dto.forceGenerate,
      },
    });

    return {
      ...document,
      compliance: complianceCheck,
    };
  }

  // ============================================================
  // FIND ALL / ONE / DOWNLOAD / SAVE TO DOSSIER
  // ============================================================

  async findAll(filter: {
    employeeId?: string;
    templateId?: string;
    status?: DocumentStatus;
    page?: number;
    limit?: number;
  }) {
    const { employeeId, templateId, status } = filter;
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(filter.limit) || 20));
    const where: any = {};

    if (employeeId) where.employeeId = employeeId;
    if (templateId) where.templateId = templateId;
    if (status) where.status = status;

    const [total, documents] = await Promise.all([
      this.prisma.generatedDocument.count({ where }),
      this.prisma.generatedDocument.findMany({
        where,
        include: {
          template: { select: { id: true, name: true, format: true } },
          employee: { select: { id: true, fullName: true, matricula: true } },
          creator: { select: { id: true, name: true } },
          pdfStorage: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: documents,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const doc = await this.prisma.generatedDocument.findUnique({
      where: { id },
      include: {
        template: true,
        templateVersion: { select: { version: true } },
        employee: { select: { id: true, fullName: true, matricula: true } },
        fileStorage: true,
        pdfStorage: true,
        creator: { select: { id: true, name: true } },
      },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado');
    return doc;
  }

  async downloadDocument(id: string, format: 'source' | 'pdf' = 'pdf') {
    const doc = await this.findOne(id);
    const storage = format === 'pdf' ? doc.pdfStorage : doc.fileStorage;

    if (!storage) {
      if (format === 'pdf') throw new BadRequestException('PDF ainda não gerado');
      throw new NotFoundException('Arquivo não encontrado');
    }

    const buffer = await this.minio.getObject(storage.bucket, storage.key);
    return { buffer, mimeType: storage.mimeType, filename: storage.originalName };
  }

  async saveToDossier(id: string, dossierFolderId: string, userId: string) {
    await this.findOne(id);
    return this.prisma.generatedDocument.update({
      where: { id },
      data: { dossierFolderId },
    });
  }

  // ============================================================
  // DOCX PREVIEW HTML
  // ============================================================

  private buildDocxPreviewHtml(
    variables: Record<string, string>,
    templateVars: Array<{ path: string; name: string }>,
  ): string {
    const vars = Array.isArray(templateVars) ? templateVars : [];
    const rows = vars.map((v) => {
      const value = variables[v.path] || '';
      const status = value
        ? `<span style="color:#16a34a">✓</span>`
        : `<span style="color:#dc2626">✗ não encontrado</span>`;
      return `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:13px">{{${v.path}}}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${value || '-'}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb">${status}</td>
      </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
  body { font-family: sans-serif; padding: 24px; color: #111; }
  h2 { color: #1d4ed8; }
  table { width:100%; border-collapse:collapse; margin-top:16px; }
  th { background:#f3f4f6; padding:8px 12px; text-align:left; font-size:13px; }
</style></head>
<body>
  <h2>Preview de Variáveis — Template DOCX</h2>
  <p style="color:#6b7280">O documento DOCX será gerado com as substituições abaixo. Confirme os valores antes de gerar.</p>
  <table>
    <thead><tr><th>Variável</th><th>Valor</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;
  }
}
