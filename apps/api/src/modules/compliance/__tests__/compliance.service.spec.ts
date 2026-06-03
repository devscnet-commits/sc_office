import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceService } from '../services/compliance.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { DocumentType, ValidityStatus } from '@prisma/client';

const mockPrisma = {
  template: { findUnique: jest.fn() },
  templateRequirement: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  employeeDocument: { findMany: jest.fn() },
  documentValidity: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  employee: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  alert: { createMany: jest.fn() },
  notification: { createMany: jest.fn() },
  user: { findMany: jest.fn() },
  $transaction: jest.fn().mockImplementation((ops) => Promise.all(ops)),
};

describe('ComplianceService', () => {
  let service: ComplianceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ComplianceService>(ComplianceService);
    jest.clearAllMocks();
  });

  describe('checkCompliance', () => {
    it('should return canGenerate=true when all required docs are present', async () => {
      mockPrisma.templateRequirement.findMany.mockResolvedValue([
        { documentType: DocumentType.RG, label: 'RG', required: true, blockGeneration: true },
        { documentType: DocumentType.CPF, label: 'CPF', required: true, blockGeneration: true },
      ]);

      mockPrisma.employeeDocument.findMany.mockResolvedValue([
        { type: DocumentType.RG, expiresAt: null, id: 'doc-1' },
        { type: DocumentType.CPF, expiresAt: null, id: 'doc-2' },
      ]);

      const result = await service.checkCompliance('template-1', 'employee-1');

      expect(result.canGenerate).toBe(true);
      expect(result.blockerCount).toBe(0);
      expect(result.requirements).toHaveLength(2);
      expect(result.requirements.every((r) => r.status === 'OK')).toBe(true);
    });

    it('should return canGenerate=false when required blocking doc is missing', async () => {
      mockPrisma.templateRequirement.findMany.mockResolvedValue([
        { documentType: DocumentType.CTPS, label: 'CTPS', required: true, blockGeneration: true },
      ]);

      mockPrisma.employeeDocument.findMany.mockResolvedValue([]);

      const result = await service.checkCompliance('template-1', 'employee-1');

      expect(result.canGenerate).toBe(false);
      expect(result.blockerCount).toBe(1);
      expect(result.requirements[0].status).toBe('MISSING');
    });

    it('should return canGenerate=false when doc is expired and blockGeneration=true', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockPrisma.templateRequirement.findMany.mockResolvedValue([
        { documentType: DocumentType.ASO, label: 'ASO', required: true, blockGeneration: true },
      ]);

      mockPrisma.employeeDocument.findMany.mockResolvedValue([
        { type: DocumentType.ASO, expiresAt: yesterday, id: 'doc-aso' },
      ]);

      const result = await service.checkCompliance('template-1', 'employee-1');

      expect(result.canGenerate).toBe(false);
      expect(result.requirements[0].status).toBe('EXPIRED');
    });

    it('should allow generation when non-blocking doc is missing', async () => {
      mockPrisma.templateRequirement.findMany.mockResolvedValue([
        { documentType: DocumentType.CNH, label: 'CNH', required: false, blockGeneration: false },
      ]);

      mockPrisma.employeeDocument.findMany.mockResolvedValue([]);

      const result = await service.checkCompliance('template-1', 'employee-1');

      expect(result.canGenerate).toBe(true);
      expect(result.blockerCount).toBe(0);
      expect(result.requirements[0].status).toBe('MISSING');
    });

    it('should return canGenerate=true with no requirements', async () => {
      mockPrisma.templateRequirement.findMany.mockResolvedValue([]);
      mockPrisma.employeeDocument.findMany.mockResolvedValue([]);

      const result = await service.checkCompliance('template-1', 'employee-1');

      expect(result.canGenerate).toBe(true);
      expect(result.requirements).toHaveLength(0);
    });
  });

  describe('getHealthScore', () => {
    it('should return CRITICAL level when employee has no data', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        fullName: 'Teste Silva',
        rg: null,
        phone: null,
        cellphone: null,
        zipCode: null,
        pis: null,
        ctps: null,
        bankName: null,
        cpf: '111.111.111-11',
        birthDate: new Date('1990-01-01'),
        email: 'teste@test.com',
        departmentId: 'dept-1',
        positionId: 'pos-1',
        admissionDate: new Date('2024-01-01'),
        position: { title: 'Analista' },
        department: { name: 'TI' },
        employeeDocuments: [],
        documentValidity: [],
      });

      const result = await service.getHealthScore('emp-1');

      expect(result.level).toBe('CRITICAL');
      expect(result.overallScore).toBeLessThan(50);
    });

    it('should return COMPLETE when employee has all data and valid docs', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({
        id: 'emp-2',
        fullName: 'João Completo',
        rg: '12.345.678-9',
        phone: '(48) 3333-4444',
        cellphone: '(48) 99999-8888',
        zipCode: '88010-000',
        pis: '123.45678.90-1',
        ctps: '1234567',
        bankName: 'Banco do Brasil',
        cpf: '111.111.111-11',
        birthDate: new Date('1990-01-01'),
        email: 'joao@test.com',
        departmentId: 'dept-1',
        positionId: 'pos-1',
        admissionDate: new Date('2020-01-01'),
        bankAgency: '1234',
        bankAccount: '12345-6',
        position: { title: 'Desenvolvedor' },
        department: { name: 'TI' },
        employeeDocuments: [
          { type: DocumentType.RG },
          { type: DocumentType.CPF },
          { type: DocumentType.CTPS },
        ],
        documentValidity: [],
      });

      const result = await service.getHealthScore('emp-2');

      expect(result.level).toBe('COMPLETE');
      expect(result.overallScore).toBeGreaterThanOrEqual(90);
    });
  });
});
