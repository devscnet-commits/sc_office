import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ComplianceService } from '../services/compliance.service';
import { differenceInDays, isAfter } from 'date-fns';

@Processor('expiration-check')
export class ExpirationCheckProcessor {
  private readonly logger = new Logger(ExpirationCheckProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly compliance: ComplianceService,
  ) {}

  @Process('daily-check')
  async handleDailyCheck(job: Job) {
    this.logger.log('Running daily expiration check...');

    // 1. Refresh all validity statuses
    const { updated } = await this.compliance.refreshAllValidityStatuses();
    this.logger.log(`Updated ${updated} validity records`);

    // 2. Get all expiring/expired records
    const validity = await this.prisma.documentValidity.findMany({
      where: {
        expirationDate: { not: null },
        status: { in: ['EXPIRED', 'CRITICAL', 'EXPIRING_SOON'] },
      },
      include: {
        employee: {
          select: { id: true, fullName: true, status: true },
        },
      },
    });

    const today = new Date();
    const alertsToCreate: any[] = [];
    const notificationsToCreate: any[] = [];

    // Get RH users to notify
    const rhUsers = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'RH'] }, status: 'ACTIVE' },
      select: { id: true },
    });

    for (const v of validity) {
      if (!v.expirationDate || v.employee.status !== 'ACTIVE') continue;

      const daysLeft = differenceInDays(new Date(v.expirationDate), today);
      const label = this.getDocumentLabel(v.documentType as any);

      // Only alert once per threshold crossing
      const shouldNotify = daysLeft < 0 || daysLeft === 7 || daysLeft === 15 || daysLeft === 30;
      if (!shouldNotify) continue;

      // Create alert
      const severity = daysLeft < 0 ? 'CRITICAL' : daysLeft <= 7 ? 'CRITICAL' : 'WARNING';
      const title =
        daysLeft < 0
          ? `${label} vencido`
          : `${label} vence em ${daysLeft} dias`;

      alertsToCreate.push({
        type: daysLeft < 0 ? 'DOCUMENT_EXPIRED' : 'DOCUMENT_EXPIRING',
        severity,
        employeeId: v.employeeId,
        documentType: v.documentType,
        title,
        message: `Funcionário ${v.employee.fullName}: ${title}`,
        metadata: { daysLeft, expirationDate: v.expirationDate },
      });

      // Create notifications for RH users
      for (const user of rhUsers) {
        notificationsToCreate.push({
          userId: user.id,
          title,
          message: `Funcionário: ${v.employee.fullName}`,
          type: 'EXPIRATION',
          employeeId: v.employeeId,
          metadata: { documentType: v.documentType, daysLeft },
        });
      }

      // Update notifiedAt
      await this.prisma.documentValidity.update({
        where: { id: v.id },
        data: { notifiedAt: new Date() },
      });
    }

    // Batch create alerts and notifications
    if (alertsToCreate.length > 0) {
      await this.prisma.alert.createMany({ data: alertsToCreate, skipDuplicates: false });
    }
    if (notificationsToCreate.length > 0) {
      await this.prisma.notification.createMany({ data: notificationsToCreate });
    }

    this.logger.log(
      `Daily check complete: ${alertsToCreate.length} alerts, ${notificationsToCreate.length} notifications created`,
    );

    return { updated, alerts: alertsToCreate.length };
  }

  private getDocumentLabel(type: string): string {
    const labels: Record<string, string> = {
      RG: 'RG',
      CPF: 'CPF',
      CTPS: 'Carteira de Trabalho',
      COMPROVANTE_ENDERECO: 'Comprovante de Endereço',
      ASO: 'Atestado de Saúde Ocupacional',
      CNH: 'CNH',
      CERTIFICADO: 'Certificado',
    };
    return labels[type] || type;
  }
}
