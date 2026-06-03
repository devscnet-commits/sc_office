import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const company = await this.prisma.company.findFirst();
    if (!company) throw new NotFoundException('Dados da empresa não configurados');
    return company;
  }

  async upsert(data: any) {
    const existing = await this.prisma.company.findFirst();
    if (existing) {
      return this.prisma.company.update({ where: { id: existing.id }, data });
    }
    return this.prisma.company.create({ data });
  }
}
