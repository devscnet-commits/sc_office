import {
  Injectable, ConflictException, NotFoundException, BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CreateUserDto, UpdateUserDto, ResetUserPasswordDto } from '../dto/user.dto';

const SELECT_USER = {
  id: true, name: true, email: true, role: true, status: true,
  avatarUrl: true, lastLoginAt: true, mustChangePassword: true,
  createdAt: true, updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: SELECT_USER,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SELECT_USER });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async create(dto: CreateUserDto, bcryptRounds: number = 12) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email já cadastrado');

    const passwordHash = await bcrypt.hash(dto.password, bcryptRounds);

    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, passwordHash, role: dto.role, mustChangePassword: true },
      select: SELECT_USER,
    });

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    if (dto.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (conflict) throw new ConflictException('Email já em uso');
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: SELECT_USER,
    });
  }

  async resetPassword(id: string, dto: ResetUserPasswordDto, bcryptRounds: number = 12) {
    await this.findOne(id);
    const passwordHash = await bcrypt.hash(dto.password, bcryptRounds);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true, passwordChangedAt: new Date() },
    });
    return { message: 'Senha redefinida. O usuário precisará trocar na próxima entrada.' };
  }

  async deactivate(id: string, requesterId: string) {
    if (id === requesterId) throw new BadRequestException('Não é possível desativar sua própria conta');
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { status: 'INACTIVE' },
      select: SELECT_USER,
    });
  }

  async activate(id: string) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
      select: SELECT_USER,
    });
  }
}
