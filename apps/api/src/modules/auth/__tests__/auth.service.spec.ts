import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../services/auth.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { UnauthorizedException } from '@nestjs/common';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  passwordReset: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockJwt = {
  signAsync: jest.fn().mockResolvedValue('mock-token'),
};

const mockConfig = {
  get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
    const configs: Record<string, any> = {
      'auth.jwtSecret': 'test-secret',
      'auth.jwtExpiresIn': '15m',
      'auth.refreshTokenSecret': 'refresh-secret',
      'auth.refreshTokenExpiresIn': '7d',
      'auth.bcryptRounds': 10,
      'auth.passwordResetExpiresIn': 3600,
    };
    return configs[key] ?? defaultValue;
  }),
};

const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return tokens and user on valid credentials', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        passwordHash,
        role: 'RH',
        status: 'ACTIVE',
        name: 'Test User',
        mustChangePassword: false,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.login(
        { email: 'test@test.com', password: 'password123' },
        '127.0.0.1',
        'test-agent',
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@test.com');
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        passwordHash,
        status: 'ACTIVE',
      });

      await expect(
        service.login({ email: 'test@test.com', password: 'wrong-password' }, '127.0.0.1', ''),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'notfound@test.com', password: 'password' }, '', ''),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const passwordHash = await bcrypt.hash('password', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'inactive@test.com',
        passwordHash,
        status: 'INACTIVE',
      });

      await expect(
        service.login({ email: 'inactive@test.com', password: 'password' }, '', ''),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should revoke refresh token', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout('user-1', 'token-123');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', token: 'token-123' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
