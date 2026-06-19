import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { DocumentType, ValidityStatus } from '@prisma/client';
import { differenceInDays, isAfter } from 'date-fns';
import { CreateRequirementDto, SetValidityDto } from '../dto/compliance.dto';

export interface ComplianceCheck {
  templateId: string;
  employeeId: string;
  canGenerate: boolean;
  requirements: RequirementStatus[];
  missingCount: number;
  blockerCount: number;
}

export interface RequirementStatus {
  documentType: DocumentType;
  label: string;
  required: boolean;
  blockGeneration: boolean;
  status: 'OK' | 'MISSING' | 'EXPIRED';
  documentId?: string;
  expiresAt?: Date;
}

export interface EmployeeHealthScore {
  employeeId: string;
  employeeName: string;
  registrationScore: number;    // % campos obrigatórios preenchidos
  documentsScore: number;       // % documentos sem vencimento crítico
  complianceScore: number;      // % requisitos de templates atendidos
  overallScore: number;         // média ponderada
  level: 'COMPLETE' | 'GOOD' | 'ATTENTION' | 'CRITICAL';
  pendingDocuments: string[];
  expiredDocuments: string[];
  observations: string[];
}

export interface ExpirationDashboard {
  expired: DocumentValidity[];
  critical: DocumentValidity[];   // <= 7 days
  expiringSoon: DocumentValidity[]; // <= 30 days
  totalEmployeesWithPendencies: number;
}

interface DocumentValidity {
  employeeId: string;
  employeeName: string;
  documentType: DocumentType;
  label: string;
  expirationDate: Date;
  daysUntilExpiration: number;
  status: ValidityStatus;
  employeeDocumentId?: string | null;
  dossierFileId?: string | null;
  documentName?: string | null;
}

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  RG: 'RG',
  CPF: 'CPF',
  CTPS: 'Carteira de Trabalho',
  COMPROVANTE_ENDERECO: 'Comprovante de Endereço',
  ASO: 'Atestado de Saúde Ocupacional',
  CNH: 'CNH',
  CERTIFICADO: 'Certificado',
  CONTRATO: 'Contrato',
  ADVERTENCIA: 'Advertência',
  FERIAS: 'Férias',
  RESCISAO: 'Rescisão',
  TREINAMENTO: 'Treinamento',
  DIPLOMA: 'Diploma',
  RESERVISTA: 'Certificado de Reservista',
  TITULO_ELEITOR: 'Título de Eleitor',
  FOTO_3X4: 'Foto 3x4',
  OUTRO: 'Outro',
};

// Required registration fields for health score calculation
const REQUIRED_EMPLOYEE_FIELDS = [
  'fullName', 'cpf', 'birthDate', 'email', 'departmentId', 'positionId', 'admissionDate',
];
const OPTIONAL_BUT_SCORED_FIELDS = [
  'rg', 'cellphone', 'zipCode', 'street', 'city', 'state', 'pis', 'ctps',
  'bankName', 'bankAgency', 'bankAccount',
];

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // TEMPLATE REQUIREMENTS
  // ============================================================

  async setRequirements(templateId: string, requirements: CreateRequirementDto[]) {
    const template = await this.prisma.template.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException('Template não encontrado');

    // Replace all requirements atomically
    await this.prisma.$transaction([
      this.prisma.templateRequirement.deleteMany({ where: { templateId } }),
      this.prisma.templateRequirement.createMany({
        data: requirements.map((r, i) => ({
          templateId,
          documentType: r.documentType,
          label: r.label || DOCUMENT_TYPE_LABELS[r.documentType],
          description: r.description,
          required: r.required ?? true,
          blockGeneration: r.blockGeneration ?? true,
          order: r.order ?? i,
        })),
      }),
    ]);

    return this.prisma.templateRequirement.findMany({
      where: { templateId },
      orderBy: { order: 'asc' },
    });
  }

  async getRequirements(templateId: string) {
    return this.prisma.templateRequirement.findMany({
      where: { templateId },
      orderBy: { order: 'asc' },
    });
  }

  async addRequirement(templateId: string, dto: CreateRequirementDto) {
    const template = await this.prisma.template.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException('Template não encontrado');

    return this.prisma.templateRequirement.create({
      data: {
        templateId,
        documentType: dto.documentType,
        label: dto.label || DOCUMENT_TYPE_LABELS[dto.documentType],
        description: dto.description,
        required: dto.required ?? true,
        blockGeneration: dto.blockGeneration ?? true,
        order: dto.order ?? 0,
      },
    });
  }

  async removeRequirement(requirementId: string) {
    return this.prisma.templateRequirement.delete({ where: { id: requirementId } });
  }

  // ============================================================
  // PRE-GENERATION COMPLIANCE CHECK
  // ============================================================

  async checkCompliance(templateId: string, employeeId: string): Promise<ComplianceCheck> {
    const [requirements, employeeDocuments] = await Promise.all([
      this.prisma.templateRequirement.findMany({
        where: { templateId },
        orderBy: { order: 'asc' },
      }),
      this.prisma.employeeDocument.findMany({
        where: { employeeId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const documentMap = new Map<DocumentType, typeof employeeDocuments[0]>();
    for (const doc of employeeDocuments) {
      if (!documentMap.has(doc.type)) {
        documentMap.set(doc.type, doc);
      }
    }

    const statuses: RequirementStatus[] = requirements.map((req) => {
      const doc = documentMap.get(req.documentType);

      if (!doc) {
        return {
          documentType: req.documentType,
          label: req.label,
          required: req.required,
          blockGeneration: req.blockGeneration,
          status: 'MISSING',
        };
      }

      const isExpired = doc.expiresAt && !isAfter(doc.expiresAt, new Date());

      return {
        documentType: req.documentType,
        label: req.label,
        required: req.required,
        blockGeneration: req.blockGeneration,
        status: isExpired ? 'EXPIRED' : 'OK',
        documentId: doc.id,
        expiresAt: doc.expiresAt || undefined,
      };
    });

    const blockers = statuses.filter(
      (s) => s.blockGeneration && (s.status === 'MISSING' || s.status === 'EXPIRED'),
    );

    return {
      templateId,
      employeeId,
      canGenerate: blockers.length === 0,
      requirements: statuses,
      missingCount: statuses.filter((s) => s.status !== 'OK').length,
      blockerCount: blockers.length,
    };
  }

  // ============================================================
  // DOCUMENT VALIDITY
  // ============================================================

  async setValidity(employeeId: string, dto: SetValidityDto) {
    const status = this.computeValidityStatus(
      dto.expirationDate ? new Date(dto.expirationDate) : null,
    );

    return this.prisma.documentValidity.upsert({
      where: { employeeId_documentType: { employeeId, documentType: dto.documentType } },
      create: {
        employeeId,
        documentType: dto.documentType,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
        expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : undefined,
        status,
        employeeDocumentId: dto.employeeDocumentId,
        dossierFileId: dto.dossierFileId,
        notes: dto.notes,
      },
      update: {
        issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
        expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : undefined,
        status,
        employeeDocumentId: dto.employeeDocumentId,
        dossierFileId: dto.dossierFileId,
        notes: dto.notes,
      },
    });
  }

  async getEmployeeValidity(employeeId: string) {
    return this.prisma.documentValidity.findMany({
      where: { employeeId },
      include: {
        employeeDocument: {
          include: { fileStorage: true },
        },
      },
      orderBy: [{ status: 'asc' }, { expirationDate: 'asc' }],
    });
  }

  // ============================================================
  // EXPIRATION DASHBOARD
  // ============================================================

  async getExpirationDashboard(): Promise<ExpirationDashboard> {
    const all = await this.prisma.documentValidity.findMany({
      where: {
        expirationDate: { not: null },
        status: { not: 'NOT_APPLICABLE' },
      },
      include: {
        employee: { select: { id: true, fullName: true, status: true } },
        employeeDocument: { select: { id: true, name: true } },
        dossierFile: { select: { id: true, name: true } },
      },
      orderBy: { expirationDate: 'asc' },
    });

    const today = new Date();

    const toDto = (v: any): DocumentValidity => ({
      employeeId: v.employeeId,
      employeeName: v.employee.fullName,
      documentType: v.documentType,
      label: DOCUMENT_TYPE_LABELS[v.documentType as DocumentType],
      expirationDate: v.expirationDate,
      daysUntilExpiration: differenceInDays(new Date(v.expirationDate), today),
      status: v.status,
      employeeDocumentId: v.employeeDocumentId,
      dossierFileId: v.dossierFileId,
      documentName: v.employeeDocument?.name ?? v.dossierFile?.name ?? null,
    });

    const expired = all
      .filter((v) => v.status === 'EXPIRED' || (v.expirationDate && !isAfter(v.expirationDate, today)))
      .map(toDto);

    const critical = all
      .filter((v) => {
        if (!v.expirationDate || !isAfter(v.expirationDate, today)) return false;
        const days = differenceInDays(new Date(v.expirationDate), today);
        return days <= 7;
      })
      .map(toDto);

    const expiringSoon = all
      .filter((v) => {
        if (!v.expirationDate || !isAfter(v.expirationDate, today)) return false;
        const days = differenceInDays(new Date(v.expirationDate), today);
        return days > 7 && days <= 30;
      })
      .map(toDto);

    const employeeIdsWithIssues = new Set([
      ...expired.map((v) => v.employeeId),
      ...critical.map((v) => v.employeeId),
    ]);

    return {
      expired,
      critical,
      expiringSoon,
      totalEmployeesWithPendencies: employeeIdsWithIssues.size,
    };
  }

  // ============================================================
  // EMPLOYEE COMPLIANCE / PENDENCIES
  // ============================================================

  async getEmployeePendencies(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        employeeDocuments: true,
        documentValidity: true,
        position: { select: { title: true } },
        department: { select: { name: true } },
      },
    });

    if (!employee) throw new NotFoundException('Funcionário não encontrado');

    const today = new Date();
    const pendencies: { type: string; label: string; severity: 'low' | 'medium' | 'high' }[] = [];

    // Check expired documents
    for (const validity of employee.documentValidity) {
      if (!validity.expirationDate) continue;
      const daysLeft = differenceInDays(new Date(validity.expirationDate), today);

      if (daysLeft < 0) {
        pendencies.push({
          type: 'expired',
          label: `${DOCUMENT_TYPE_LABELS[validity.documentType]} vencido`,
          severity: 'high',
        });
      } else if (daysLeft <= 7) {
        pendencies.push({
          type: 'expiring_critical',
          label: `${DOCUMENT_TYPE_LABELS[validity.documentType]} vence em ${daysLeft} dias`,
          severity: 'high',
        });
      } else if (daysLeft <= 30) {
        pendencies.push({
          type: 'expiring_soon',
          label: `${DOCUMENT_TYPE_LABELS[validity.documentType]} vence em ${daysLeft} dias`,
          severity: 'medium',
        });
      }
    }

    // Missing registration fields
    const missingFields: string[] = [];
    if (!employee.rg) missingFields.push('RG');
    if (!employee.phone && !employee.cellphone) missingFields.push('Telefone');
    if (!employee.zipCode) missingFields.push('Endereço (CEP)');
    if (!employee.pis) missingFields.push('PIS/PASEP');
    if (!employee.ctps) missingFields.push('CTPS');
    if (!employee.bankName) missingFields.push('Dados bancários');

    if (missingFields.length > 0) {
      pendencies.push({
        type: 'incomplete_registration',
        label: `Cadastro incompleto: ${missingFields.join(', ')}`,
        severity: 'low',
      });
    }

    return {
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        matricula: employee.matricula,
        position: employee.position.title,
        department: employee.department.name,
      },
      pendencies,
      totalPendencies: pendencies.length,
      hasCritical: pendencies.some((p) => p.severity === 'high'),
    };
  }

  // ============================================================
  // HEALTH SCORE
  // ============================================================

  async getHealthScore(employeeId: string): Promise<EmployeeHealthScore> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        employeeDocuments: true,
        documentValidity: true,
        position: { select: { title: true } },
        department: { select: { name: true } },
      },
    });

    if (!employee) throw new NotFoundException('Funcionário não encontrado');

    // Registration score
    const requiredFilled = REQUIRED_EMPLOYEE_FIELDS.filter(
      (f) => !!(employee as any)[f],
    ).length;
    const optionalFilled = OPTIONAL_BUT_SCORED_FIELDS.filter(
      (f) => !!(employee as any)[f],
    ).length;

    const registrationScore = Math.round(
      (requiredFilled / REQUIRED_EMPLOYEE_FIELDS.length) * 70 +
        (optionalFilled / OPTIONAL_BUT_SCORED_FIELDS.length) * 30,
    );

    // Documents score
    const today = new Date();
    const expiredDocuments: string[] = [];
    const expiringDocuments: string[] = [];

    for (const validity of employee.documentValidity) {
      if (!validity.expirationDate) continue;
      const daysLeft = differenceInDays(new Date(validity.expirationDate), today);
      if (daysLeft < 0) {
        expiredDocuments.push(DOCUMENT_TYPE_LABELS[validity.documentType]);
      } else if (daysLeft <= 7) {
        expiringDocuments.push(DOCUMENT_TYPE_LABELS[validity.documentType]);
      }
    }

    const docCount = employee.employeeDocuments.length;
    const documentsScore = docCount === 0
      ? 50
      : Math.max(0, 100 - expiredDocuments.length * 30 - expiringDocuments.length * 15);

    const pendingDocuments: string[] = [];
    if (!employee.employeeDocuments.find((d) => d.type === 'RG')) pendingDocuments.push('RG');
    if (!employee.employeeDocuments.find((d) => d.type === 'CPF')) pendingDocuments.push('CPF');
    if (!employee.employeeDocuments.find((d) => d.type === 'CTPS')) pendingDocuments.push('CTPS');

    const complianceScore = Math.max(0, 100 - pendingDocuments.length * 20 - expiredDocuments.length * 25);
    const overallScore = Math.round(registrationScore * 0.4 + documentsScore * 0.35 + complianceScore * 0.25);

    const level: EmployeeHealthScore['level'] =
      overallScore >= 90 ? 'COMPLETE' :
      overallScore >= 70 ? 'GOOD' :
      overallScore >= 50 ? 'ATTENTION' : 'CRITICAL';

    const observations: string[] = [];
    if (expiredDocuments.length > 0) observations.push(`${expiredDocuments.length} documento(s) vencido(s)`);
    if (expiringDocuments.length > 0) observations.push(`${expiringDocuments.length} vencendo em breve`);
    if (pendingDocuments.length > 0) observations.push(`${pendingDocuments.length} documento(s) pendente(s)`);

    return {
      employeeId,
      employeeName: employee.fullName,
      registrationScore,
      documentsScore,
      complianceScore,
      overallScore,
      level,
      pendingDocuments,
      expiredDocuments,
      observations,
    };
  }

  // ============================================================
  // BULK HEALTH SCORES (for dashboard list)
  // ============================================================

  async getHealthScoreList(filter: { departmentId?: string; status?: string }) {
    const where: any = { status: filter.status || 'ACTIVE' };
    if (filter.departmentId) where.departmentId = filter.departmentId;

    const employees = await this.prisma.employee.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        matricula: true,
        departmentId: true,
        positionId: true,
        position: { select: { title: true } },
        department: { select: { name: true } },
        employeeDocuments: { select: { type: true } },
        documentValidity: { select: { documentType: true, expirationDate: true, status: true } },
        rg: true,
        pis: true,
        ctps: true,
        zipCode: true,
        phone: true,
        cellphone: true,
        bankName: true,
      },
      orderBy: { fullName: 'asc' },
    });

    const today = new Date();

    return employees.map((emp) => {
      const expiredCount = emp.documentValidity.filter((v) => {
        if (!v.expirationDate) return false;
        return !isAfter(new Date(v.expirationDate), today);
      }).length;

      const missingBasicDocs = [
        !emp.employeeDocuments.find((d) => d.type === 'RG'),
        !emp.employeeDocuments.find((d) => d.type === 'CPF'),
        !emp.employeeDocuments.find((d) => d.type === 'CTPS'),
      ].filter(Boolean).length;

      const score = Math.max(0, 100 - expiredCount * 25 - missingBasicDocs * 15);
      const level =
        score >= 90 ? 'COMPLETE' :
        score >= 70 ? 'GOOD' :
        score >= 50 ? 'ATTENTION' : 'CRITICAL';

      return {
        employeeId: emp.id,
        fullName: emp.fullName,
        matricula: emp.matricula,
        position: emp.position.title,
        department: emp.department.name,
        score,
        level,
        expiredDocuments: expiredCount,
        missingDocuments: missingBasicDocs,
      };
    });
  }

  // ============================================================
  // DAILY EXPIRATION REFRESH (called by BullMQ job)
  // ============================================================

  async refreshAllValidityStatuses(): Promise<{ updated: number }> {
    const records = await this.prisma.documentValidity.findMany({
      where: { expirationDate: { not: null } },
    });

    let updated = 0;
    for (const record of records) {
      if (!record.expirationDate) continue;
      const newStatus = this.computeValidityStatus(record.expirationDate);
      if (newStatus !== record.status) {
        await this.prisma.documentValidity.update({
          where: { id: record.id },
          data: { status: newStatus },
        });
        updated++;
      }
    }

    return { updated };
  }

  private computeValidityStatus(expirationDate: Date | null): ValidityStatus {
    if (!expirationDate) return 'NOT_APPLICABLE';
    const today = new Date();
    const daysLeft = differenceInDays(new Date(expirationDate), today);

    if (daysLeft < 0) return 'EXPIRED';
    if (daysLeft <= 7) return 'CRITICAL';
    if (daysLeft <= 30) return 'EXPIRING_SOON';
    return 'VALID';
  }
}
