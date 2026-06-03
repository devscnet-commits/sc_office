import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/audit.service';

export interface CreateDepartmentDto {
  name: string;
  code: string;
  description?: string;
  parentId?: string;
  managerId?: string;
  order?: number;
}

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateDepartmentDto, userId: string) {
    const existing = await this.prisma.department.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Código de departamento já existe');

    const department = await this.prisma.department.create({ data: dto });

    await this.audit.log({
      userId,
      action: 'CREATE',
      module: 'departments',
      entityType: 'department',
      entityId: department.id,
      newValues: { name: dto.name, code: dto.code },
    });

    return department;
  }

  async findAll() {
    return this.prisma.department.findMany({
      where: { active: true },
      include: {
        children: { where: { active: true } },
        positions: { where: { active: true }, select: { id: true, title: true, code: true } },
        _count: { select: { employees: true } },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async findTree() {
    const all = await this.prisma.department.findMany({
      where: { active: true },
      include: {
        positions: { where: { active: true } },
        _count: { select: { employees: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    // Build tree structure
    const map = new Map(all.map((d) => [d.id, { ...d, children: [] as any[] }]));
    const roots: any[] = [];

    for (const dept of map.values()) {
      if (dept.parentId && map.has(dept.parentId)) {
        map.get(dept.parentId)!.children.push(dept);
      } else {
        roots.push(dept);
      }
    }

    return roots;
  }

  async findOne(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        positions: true,
        employees: {
          where: { status: 'ACTIVE' },
          select: { id: true, fullName: true, matricula: true },
        },
      },
    });
    if (!dept) throw new NotFoundException('Departamento não encontrado');
    return dept;
  }

  async update(id: string, dto: Partial<CreateDepartmentDto>, userId: string) {
    await this.findOne(id);
    const updated = await this.prisma.department.update({ where: { id }, data: dto });
    await this.audit.log({ userId, action: 'UPDATE', module: 'departments', entityType: 'department', entityId: id });
    return updated;
  }

  async remove(id: string, userId: string) {
    const dept = await this.findOne(id);
    const hasEmployees = await this.prisma.employee.count({
      where: { departmentId: id, status: 'ACTIVE' },
    });
    if (hasEmployees > 0) throw new ConflictException('Departamento possui funcionários ativos');

    await this.prisma.department.update({ where: { id }, data: { active: false } });
    await this.audit.log({ userId, action: 'DELETE', module: 'departments', entityType: 'department', entityId: id });
    return { message: 'Departamento desativado' };
  }
}
