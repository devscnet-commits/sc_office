import {
  Controller, Get, Post, Body, Param, Query, Res, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';
import { DocumentsService, GenerateDocumentDto } from '../services/documents.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';

@ApiTags('documents')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Gerar documento a partir de template + funcionário' })
  generate(@Body() dto: GenerateDocumentDto, @CurrentUser('id') userId: string) {
    return this.service.generate(dto, userId);
  }

  @Get()
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
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

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
  saveToDossier(
    @Param('id') id: string,
    @Body('dossierFolderId') dossierFolderId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.saveToDossier(id, dossierFolderId, userId);
  }
}
