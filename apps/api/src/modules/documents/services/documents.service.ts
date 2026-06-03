import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { MinioService } from '../../../infrastructure/minio/minio.service';
import { TemplateEngineService } from '../../templates/engines/template-engine.service';
import { EmployeesService } from '../../employees/services/employees.service';
import { AuditService } from '../../audit/audit.service';
import { TemplateFormat, DocumentStatus } from '@prisma/client';

export interface GenerateDocumentDto {
  templateId: string;
  employeeId: string;
  name?: string;
  dossierFolderId?: string;
  additionalVariables?: Record<string, string>;
  notes?: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly engine: TemplateEngineService,
    private readonly employeesService: EmployeesService,
    private readonly audit: AuditService,
    @InjectQueue('pdf-generation') private readonly pdfQueue: Queue,
  ) {}

  async generate(dto: GenerateDocumentDto, userId: string) {
    const [template, employeeVars] = await Promise.all([
      this.prisma.template.findUnique({
        where: { id: dto.templateId },
        include: { fileStorage: true },
      }),
      this.employeesService.getVariables(dto.employeeId),
    ]);

    if (!template) throw new NotFoundException('Template não encontrado');

    // Get company variables
    const company = await this.prisma.company.findFirst();
    const companyVars = company
      ? {
          'empresa.nome': company.name,
          'empresa.nome_fantasia': company.tradeName || company.name,
          'empresa.cnpj': company.cnpj,
          'empresa.endereco': `${company.street}, ${company.number}`,
          'empresa.cidade': company.city || '',
          'empresa.estado': company.state || '',
          'empresa.cep': company.zipCode || '',
          'empresa.telefone': company.phone || '',
          'empresa.email': company.email || '',
        }
      : {};

    // Date variables
    const now = new Date();
    const dateVars = {
      'data.hoje': now.toLocaleDateString('pt-BR'),
      'data.hoje_extenso': now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      'data.ano': now.getFullYear().toString(),
      'data.mes': (now.getMonth() + 1).toString().padStart(2, '0'),
      'data.dia': now.getDate().toString().padStart(2, '0'),
    };

    const allVariables = {
      ...employeeVars,
      ...companyVars,
      ...dateVars,
      ...(dto.additionalVariables || {}),
    };

    // Generate document
    let generatedBuffer: Buffer;
    let mimeType: string;
    let extension: string;

    if (template.format === TemplateFormat.DOCX) {
      if (!template.fileStorage) {
        throw new BadRequestException('Template DOCX não possui arquivo associado');
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

    const docName = dto.name || `${template.name} - ${new Date().toLocaleDateString('pt-BR')}`;

    // Upload generated doc
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

    const document = await this.prisma.generatedDocument.create({
      data: {
        name: docName,
        templateId: dto.templateId,
        employeeId: dto.employeeId,
        status: DocumentStatus.GENERATED,
        variables: allVariables,
        fileStorageId: fileStorage.id,
        dossierFolderId: dto.dossierFolderId,
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

    // Queue PDF generation
    await this.pdfQueue.add('generate-pdf', {
      documentId: document.id,
      format: template.format,
      fileStorageId: fileStorage.id,
      userId,
    });

    await this.audit.log({
      userId,
      action: 'CREATE',
      module: 'documents',
      entityType: 'generated_document',
      entityId: document.id,
      newValues: { name: docName, employeeId: dto.employeeId },
    });

    return document;
  }

  async findAll(filter: {
    employeeId?: string;
    templateId?: string;
    status?: DocumentStatus;
    page?: number;
    limit?: number;
  }) {
    const { employeeId, templateId, status, page = 1, limit = 20 } = filter;
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
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data: documents, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const doc = await this.prisma.generatedDocument.findUnique({
      where: { id },
      include: {
        template: true,
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
      if (format === 'pdf') {
        throw new BadRequestException('PDF ainda não gerado, tente novamente em instantes');
      }
      throw new NotFoundException('Arquivo não encontrado');
    }

    const buffer = await this.minio.getObject(storage.bucket, storage.key);
    return {
      buffer,
      mimeType: storage.mimeType,
      filename: storage.originalName,
    };
  }

  async saveToDossier(id: string, dossierFolderId: string, userId: string) {
    const doc = await this.findOne(id);

    return this.prisma.generatedDocument.update({
      where: { id },
      data: { dossierFolderId, status: DocumentStatus.GENERATED },
    });
  }
}
