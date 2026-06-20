import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from '../dto/login.dto';
import { createId } from '@paralleldrive/cuid2';
import { addSeconds, addDays } from 'date-fns';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto, ipAddress: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email, deletedAt: null },
    });

    if (!user) {
      await this.auditService.log({
        action: 'LOGIN',
        module: 'auth',
        entityType: 'user',
        ipAddress,
        userAgent,
        success: false,
        description: `Tentativa de login com e-mail inexistente: ${dto.email}`,
      });
      throw new UnauthorizedException('Não existe conta com este e-mail');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.auditService.log({
        action: 'LOGIN',
        module: 'auth',
        entityType: 'user',
        entityId: user.id,
        ipAddress,
        userAgent,
        success: false,
        description: `Senha incorreta para: ${dto.email}`,
      });
      throw new UnauthorizedException('Senha incorreta');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Usuário inativo ou suspenso');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    await this.prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: addDays(new Date(), 7),
        ipAddress,
        userAgent,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'LOGIN',
      module: 'auth',
      entityType: 'user',
      entityId: user.id,
      ipAddress,
      userAgent,
      success: true,
      description: 'Login realizado com sucesso',
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async refreshToken(dto: RefreshTokenDto, ipAddress: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    if (stored.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Usuário inativo');
    }

    // Rotate refresh token
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.generateTokens(
      stored.user.id,
      stored.user.email,
      stored.user.role,
    );

    await this.prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: stored.user.id,
        expiresAt: addDays(new Date(), 7),
        ipAddress,
      },
    });

    return tokens;
  }

  async logout(userId: string, refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, token: refreshToken },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log({
      userId,
      action: 'LOGOUT',
      module: 'auth',
      entityType: 'user',
      entityId: userId,
      success: true,
    });
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email, deletedAt: null },
    });

    // Always return success to avoid user enumeration
    if (!user) return { message: 'Se o email existir, você receberá instruções em breve.' };

    const token = createId();
    const expiresAt = addSeconds(
      new Date(),
      this.configService.get<number>('auth.passwordResetExpiresIn', 3600),
    );

    await this.prisma.passwordReset.create({
      data: { token, userId: user.id, expiresAt },
    });

    // TODO: Send email with reset link
    // await this.mailService.sendPasswordReset(user.email, token);

    return { message: 'Se o email existir, você receberá instruções em breve.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const reset = await this.prisma.passwordReset.findUnique({
      where: { token: dto.token },
      include: { user: true },
    });

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      this.configService.get<number>('auth.bcryptRounds', 12),
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: reset.userId },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Senha alterada com sucesso' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Senha atual incorreta');
    }

    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      this.configService.get<number>('auth.bcryptRounds', 12),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false },
    });

    await this.auditService.log({
      userId,
      action: 'PASSWORD_CHANGE',
      module: 'auth',
      entityType: 'user',
      entityId: userId,
      success: true,
    });

    return { message: 'Senha alterada com sucesso' };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('auth.jwtSecret'),
        expiresIn: this.configService.get<string>('auth.jwtExpiresIn', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('auth.refreshTokenSecret'),
        expiresIn: this.configService.get<string>('auth.refreshTokenExpiresIn', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
