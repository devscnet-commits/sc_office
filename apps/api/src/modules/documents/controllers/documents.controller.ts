import {
  Controller, Get, Post, Body, Param, Query, Res, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';
import { DocumentsService, GenerateDocumentDto, PreviewDocumentDto } from '../services/documents.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';

@ApiTags('documents')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Preview do documento antes de gerar',
    description: 'Renderiza o template com os dados do funcionário sem salvar. Retorna HTML + compliance check.',
  })
  preview(@Body() dto: PreviewDocumentDto, @CurrentUser('id') userId: string) {
    return this.service.preview(dto, userId);
  }

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Gerar documento (valida compliance antes)',
    description: 'Executa compliance check. Bloqueia se documentos obrigatórios estiverem ausentes/vencidos.',
  })
  @ApiResponse({ status: 422, description: 'Compliance bloqueado — documentos obrigatórios ausentes' })
  generate(@Body() dto: GenerateDocumentDto, @CurrentUser('id') userId: string) {
    return this.service.generate(dto, userId);
  }

  @Post('generate-batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Gerar documento em lote para vários funcionários (ex: por departamento)',
    description: 'Executa a mesma geração para cada funcionário da lista. Falhas individuais não interrompem o lote.',
  })
  generateBatch(
    @Body() dto: {
      templateId: string;
      employeeIds: string[];
      dossierFolderId?: string;
      additionalVariables?: Record<string, string>;
      notes?: string;
      forceGenerate?: boolean;
    },
    @CurrentUser('id') userId: string,
  ) {
    return this.service.generateBatch(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar documentos gerados' })
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('templateId') templateId?: string,
    @Query('status') status?: DocumentStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll({ employeeId, templateId, status, page, limit });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download do documento (PDF ou source)' })
  async download(
    @Param('id') id: string,
    @Query('format') format: 'source' | 'pdf' = 'pdf',
    @Res() res: Response,
  ) {
    const { buffer, mimeType, filename } = await this.service.downloadDocument(id, format);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post(':id/save-to-dossier')
  @ApiOperation({ summary: 'Mover documento para pasta do dossiê do funcionário' })
  saveToDossier(
    @Param('id') id: string,
    @Body('dossierFolderId') dossierFolderId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.saveToDossier(id, dossierFolderId, userId);
  }
}
