import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditAction } from '@prisma/client';

export interface AuditLogParams {
  userId?: string;
  action: AuditAction | string;
  module: string;
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  description?: string;
  success?: boolean;
  errorMessage?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditLogParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action as AuditAction,
          module: params.module,
          entityType: params.entityType,
          entityId: params.entityId,
          oldValues: params.oldValues as any,
          newValues: params.newValues as any,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          description: params.description,
          success: params.success ?? true,
          errorMessage: params.errorMessage,
        },
      });
    } catch (error) {
      // Audit log failure should not break the main operation
      console.error('Audit log failed:', error);
    }
  }

  async findAll(filter: {
    userId?: string;
    module?: string;
    action?: AuditAction;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 50, startDate, endDate, ...where } = filter;

    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = startDate;
      if (endDate) dateFilter.createdAt.lte = endDate;
    }

    const queryWhere = { ...where, ...dateFilter };
    // Remove undefined values
    Object.keys(queryWhere).forEach((k) => queryWhere[k] === undefined && delete queryWhere[k]);

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where: queryWhere }),
      this.prisma.auditLog.findMany({
        where: queryWhere,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data: logs, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
