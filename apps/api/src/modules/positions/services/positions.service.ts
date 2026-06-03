import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface CreatePositionDto {
  title: string;
  code: string;
  description?: string;
  departmentId: string;
  level?: number;
  salaryMin?: number;
  salaryMax?: number;
}

@Injectable()
export class PositionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePositionDto) {
    const existing = await this.prisma.position.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Código de cargo já existe');
    return this.prisma.position.create({ data: dto });
  }

  async findAll(departmentId?: string) {
    return this.prisma.position.findMany({
      where: { active: true, ...(departmentId ? { departmentId } : {}) },
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: [{ level: 'asc' }, { title: 'asc' }],
    });
  }

  async findOne(id: string) {
    const position = await this.prisma.position.findUnique({
      where: { id },
      include: {
        department: true,
        employees: { where: { status: 'ACTIVE' }, select: { id: true, fullName: true } },
      },
    });
    if (!position) throw new NotFoundException('Cargo não encontrado');
    return position;
  }

  async update(id: string, dto: Partial<CreatePositionDto>) {
    await this.findOne(id);
    return this.prisma.position.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const pos = await this.findOne(id);
    const hasEmployees = await this.prisma.employee.count({ where: { positionId: id, status: 'ACTIVE' } });
    if (hasEmployees > 0) throw new ConflictException('Cargo possui funcionários ativos');
    return this.prisma.position.update({ where: { id }, data: { active: false } });
  }
}
