import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { MinioService } from '../../../infrastructure/minio/minio.service';
import { TemplateEngineService } from '../engines/template-engine.service';
import { AuditService } from '../../audit/audit.service';
import { TemplateFormat, TemplateStatus } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import * as crypto from 'crypto';

export interface CreateTemplateDto {
  name: string;
  description?: string;
  category?: string;
  format: TemplateFormat;
  htmlContent?: string;
}

export interface UpdateTemplateDto extends Partial<CreateTemplateDto> {
  status?: TemplateStatus;
}

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly engine: TemplateEngineService,
    private readonly audit: AuditService,
  ) {}

  async create(
    dto: CreateTemplateDto,
    file: Express.Multer.File | undefined,
    userId: string,
  ) {
    let fileStorageId: string | undefined;
    let variables: any[] = [];
    let htmlContent = dto.htmlContent;

    if (dto.format === TemplateFormat.DOCX) {
      if (!file) throw new BadRequestException('Arquivo DOCX é obrigatório');

      const uploadResult = await this.minio.uploadFile(
        this.minio.getBucketName('templates'),
        file.buffer,
        file.originalname,
        file.mimetype,
        'templates',
      );

      const fileStorage = await this.prisma.fileStorage.create({
        data: {
          bucket: uploadResult.bucket,
          key: uploadResult.key,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: BigInt(file.size),
          checksum: uploadResult.etag,
          uploadedBy: userId,
        },
      });

      fileStorageId = fileStorage.id;
      variables = await this.engine.extractVariablesFromDocx(file.buffer);
    } else if (dto.format === TemplateFormat.HTML) {
      if (!htmlContent) throw new BadRequestException('Conteúdo HTML é obrigatório');
      variables = this.engine.extractVariablesFromHtml(htmlContent);
    }

    const { valid, invalid } = this.engine.validateVariables(variables);

    const template = await this.prisma.template.create({
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        format: dto.format,
        status: TemplateStatus.DRAFT,
        fileStorageId,
        htmlContent,
        variables: valid as any,
        invalidVariables: invalid as any,
        createdBy: userId,
      },
      include: { fileStorage: true },
    });

    await this.audit.log({
      userId,
      action: 'CREATE',
      module: 'templates',
      entityType: 'template',
      entityId: template.id,
      newValues: { name: template.name, format: template.format },
    });

    return template;
  }

  async findAll(filter: {
    search?: string;
    category?: string;
    status?: TemplateStatus;
    format?: TemplateFormat;
    page?: number;
    limit?: number;
  }) {
    const { search, category, status, format } = filter;
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(filter.limit) || 20));
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = category;
    if (status) where.status = status;
    if (format) where.format = format;

    const [total, templates] = await Promise.all([
      this.prisma.template.count({ where }),
      this.prisma.template.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          format: true,
          status: true,
          version: true,
          usageCount: true,
          variables: true,
          invalidVariables: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return { data: templates, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
      include: { fileStorage: true, templateVersions: { orderBy: { version: 'desc' } } },
    });
    if (!template) throw new NotFoundException('Template não encontrado');
    return template;
  }

  async update(id: string, dto: UpdateTemplateDto, file?: Express.Multer.File, userId?: string) {
    const existing = await this.findOne(id);

    // Save version before update
    await this.prisma.templateVersion.create({
      data: {
        templateId: id,
        version: existing.version,
        htmlContent: existing.htmlContent,
        fileStorageId: existing.fileStorageId,
        variables: existing.variables as any,
        createdBy: userId || 'system',
      },
    });

    let fileStorageId = existing.fileStorageId;
    let variables = existing.variables;
    let htmlContent = dto.htmlContent || existing.htmlContent;

    if (file && existing.format === TemplateFormat.DOCX) {
      const uploadResult = await this.minio.uploadFile(
        this.minio.getBucketName('templates'),
        file.buffer,
        file.originalname,
        file.mimetype,
        'templates',
      );

      const fileStorage = await this.prisma.fileStorage.create({
        data: {
          bucket: uploadResult.bucket,
          key: uploadResult.key,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: BigInt(file.size),
          checksum: uploadResult.etag,
          uploadedBy: userId || 'system',
        },
      });

      fileStorageId = fileStorage.id;
      variables = await this.engine.extractVariablesFromDocx(file.buffer) as any;
    } else if (dto.htmlContent && existing.format === TemplateFormat.HTML) {
      variables = this.engine.extractVariablesFromHtml(dto.htmlContent) as any;
    }

    const { valid, invalid } = this.engine.validateVariables(variables as any);

    return this.prisma.template.update({
      where: { id },
      data: {
        ...dto,
        htmlContent,
        fileStorageId,
        variables: valid as any,
        invalidVariables: invalid as any,
        version: { increment: 1 },
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.template.update({
      where: { id },
      data: { deletedAt: new Date(), status: TemplateStatus.ARCHIVED },
    });
    return { message: 'Template removido com sucesso' };
  }

  async getAvailableVariables() {
    return this.engine.getAvailableVariables();
  }

  async previewVariables(id: string) {
    const template = await this.findOne(id);
    return {
      variables: template.variables,
      invalidVariables: template.invalidVariables,
      availableVariables: this.engine.getAvailableVariables(),
    };
  }
}
