import { Test, TestingModule } from '@nestjs/testing';
import { CustomFieldsService } from '../services/custom-fields.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { CustomFieldType } from '@prisma/client';

const mockPrisma = {
  customField: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  customFieldValue: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
};

describe('CustomFieldsService', () => {
  let service: CustomFieldsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomFieldsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CustomFieldsService>(CustomFieldsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create custom field with correct templateVar', async () => {
      mockPrisma.customField.findUnique.mockResolvedValue(null);
      mockPrisma.customField.create.mockResolvedValue({
        id: 'cf-1',
        name: 'numero_calcado',
        label: 'Número do Calçado',
        type: CustomFieldType.NUMBER,
        templateVar: 'custom.numero_calcado',
      });

      const result = await service.create({
        name: 'numero_calcado',
        label: 'Número do Calçado',
        type: CustomFieldType.NUMBER,
      });

      expect(mockPrisma.customField.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ templateVar: 'custom.numero_calcado' }),
        }),
      );
      expect(result.templateVar).toBe('custom.numero_calcado');
    });

    it('should throw ConflictException for duplicate name', async () => {
      mockPrisma.customField.findUnique.mockResolvedValue({ id: 'existing', name: 'numero_calcado' });

      await expect(
        service.create({ name: 'numero_calcado', label: 'X', type: CustomFieldType.TEXT }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for SELECT without options', async () => {
      mockPrisma.customField.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ name: 'tamanho', label: 'Tamanho', type: CustomFieldType.SELECT }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create SELECT field with options', async () => {
      mockPrisma.customField.findUnique.mockResolvedValue(null);
      mockPrisma.customField.create.mockResolvedValue({
        id: 'cf-2',
        name: 'tamanho_camiseta',
        templateVar: 'custom.tamanho_camiseta',
        options: ['P', 'M', 'G', 'GG'],
      });

      await service.create({
        name: 'tamanho_camiseta',
        label: 'Tamanho da Camiseta',
        type: CustomFieldType.SELECT,
        options: ['P', 'M', 'G', 'GG'],
      });

      expect(mockPrisma.customField.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ options: ['P', 'M', 'G', 'GG'] }),
        }),
      );
    });
  });

  describe('setEmployeeValue', () => {
    it('should reject invalid NUMBER value', async () => {
      mockPrisma.customField.findUnique.mockResolvedValue({
        id: 'cf-1',
        type: CustomFieldType.NUMBER,
        options: null,
      });

      await expect(
        service.setEmployeeValue('emp-1', { customFieldId: 'cf-1', value: 'nao-numero' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid SELECT value', async () => {
      mockPrisma.customField.findUnique.mockResolvedValue({
        id: 'cf-1',
        type: CustomFieldType.SELECT,
        options: ['P', 'M', 'G'],
      });

      await expect(
        service.setEmployeeValue('emp-1', { customFieldId: 'cf-1', value: 'XXXL' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid SELECT value', async () => {
      mockPrisma.customField.findUnique.mockResolvedValue({
        id: 'cf-1',
        type: CustomFieldType.SELECT,
        options: ['P', 'M', 'G'],
      });
      mockPrisma.customFieldValue.upsert.mockResolvedValue({ value: 'M' });

      const result = await service.setEmployeeValue('emp-1', {
        customFieldId: 'cf-1',
        value: 'M',
      });

      expect(result.value).toBe('M');
    });
  });

  describe('buildVariablesMap', () => {
    it('should build correct map with custom.prefix', async () => {
      mockPrisma.customFieldValue.findMany.mockResolvedValue([
        {
          value: '42',
          customField: { templateVar: 'custom.numero_calcado' },
        },
        {
          value: 'M',
          customField: { templateVar: 'custom.tamanho_camiseta' },
        },
      ]);

      const map = await service.buildVariablesMap('emp-1');

      expect(map['custom.numero_calcado']).toBe('42');
      expect(map['custom.tamanho_camiseta']).toBe('M');
    });
  });
});
