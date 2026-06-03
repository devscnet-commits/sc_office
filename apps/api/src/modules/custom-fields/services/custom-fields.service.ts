import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CustomFieldType } from '@prisma/client';
import {
  CreateCustomFieldDto,
  SetCustomFieldValueDto,
  BulkSetCustomFieldValuesDto,
} from '../dto/custom-field.dto';

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // FIELD DEFINITIONS
  // ============================================================

  async create(dto: CreateCustomFieldDto) {
    const existing = await this.prisma.customField.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Campo customizado "${dto.name}" já existe`);

    if (dto.type === CustomFieldType.SELECT && (!dto.options || dto.options.length === 0)) {
      throw new BadRequestException('Tipo SELECT requer ao menos uma opção');
    }

    const templateVar = `custom.${dto.name}`;

    return this.prisma.customField.create({
      data: {
        name: dto.name,
        label: dto.label,
        type: dto.type,
        options: dto.options ? dto.options : undefined,
        required: dto.required ?? false,
        active: true,
        order: dto.order ?? 0,
        description: dto.description,
        templateVar,
      },
    });
  }

  async findAll(includeInactive = false) {
    return this.prisma.customField.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ order: 'asc' }, { label: 'asc' }],
    });
  }

  async findOne(id: string) {
    const field = await this.prisma.customField.findUnique({ where: { id } });
    if (!field) throw new NotFoundException('Campo customizado não encontrado');
    return field;
  }

  async update(id: string, dto: Partial<CreateCustomFieldDto>) {
    await this.findOne(id);

    if (dto.type === CustomFieldType.SELECT && dto.options !== undefined && dto.options.length === 0) {
      throw new BadRequestException('Tipo SELECT requer ao menos uma opção');
    }

    return this.prisma.customField.update({
      where: { id },
      data: {
        label: dto.label,
        type: dto.type,
        options: dto.options,
        required: dto.required,
        order: dto.order,
        description: dto.description,
      },
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.customField.update({
      where: { id },
      data: { active: false },
    });
  }

  // ============================================================
  // EMPLOYEE CUSTOM FIELD VALUES
  // ============================================================

  async getEmployeeValues(employeeId: string) {
    const [fields, values] = await Promise.all([
      this.prisma.customField.findMany({ where: { active: true }, orderBy: [{ order: 'asc' }] }),
      this.prisma.customFieldValue.findMany({
        where: { employeeId },
        include: { customField: true },
      }),
    ]);

    const valueMap = new Map(values.map((v) => [v.customFieldId, v.value]));

    return fields.map((field) => ({
      field,
      value: valueMap.get(field.id) || null,
      templateVar: field.templateVar,
    }));
  }

  async setEmployeeValue(employeeId: string, dto: SetCustomFieldValueDto) {
    const field = await this.prisma.customField.findUnique({
      where: { id: dto.customFieldId },
    });
    if (!field) throw new NotFoundException('Campo customizado não encontrado');

    this.validateValue(field.type, dto.value, field.options as string[] | null);

    return this.prisma.customFieldValue.upsert({
      where: { employeeId_customFieldId: { employeeId, customFieldId: dto.customFieldId } },
      create: { employeeId, customFieldId: dto.customFieldId, value: dto.value },
      update: { value: dto.value },
    });
  }

  async bulkSetEmployeeValues(employeeId: string, dto: BulkSetCustomFieldValuesDto) {
    const results = [];
    for (const item of dto.values) {
      results.push(await this.setEmployeeValue(employeeId, item));
    }
    return results;
  }

  // ============================================================
  // BUILD VARIABLES MAP (used by template engine)
  // ============================================================

  async buildVariablesMap(employeeId: string): Promise<Record<string, string>> {
    const values = await this.prisma.customFieldValue.findMany({
      where: { employeeId },
      include: { customField: true },
    });

    const result: Record<string, string> = {};
    for (const v of values) {
      result[v.customField.templateVar] = v.value;
    }
    return result;
  }

  // ============================================================
  // GET AVAILABLE VARIABLES (for template engine registry)
  // ============================================================

  async getAvailableVariables() {
    const fields = await this.prisma.customField.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
    });

    return fields.map((f) => ({
      name: `{{${f.templateVar}}}`,
      path: f.templateVar,
      isValid: true,
      description: f.label,
      isCustom: true,
    }));
  }

  private validateValue(type: CustomFieldType, value: string, options: string[] | null) {
    switch (type) {
      case CustomFieldType.NUMBER:
        if (isNaN(parseFloat(value))) {
          throw new BadRequestException(`Valor "${value}" não é um número válido`);
        }
        break;
      case CustomFieldType.DATE:
        if (isNaN(Date.parse(value))) {
          throw new BadRequestException(`Valor "${value}" não é uma data válida`);
        }
        break;
      case CustomFieldType.BOOLEAN:
        if (!['true', 'false', '1', '0', 'sim', 'não'].includes(value.toLowerCase())) {
          throw new BadRequestException(`Valor "${value}" não é um booleano válido`);
        }
        break;
      case CustomFieldType.SELECT:
        if (options && !options.includes(value)) {
          throw new BadRequestException(
            `Valor "${value}" inválido. Opções: ${options.join(', ')}`,
          );
        }
        break;
    }
  }
}
