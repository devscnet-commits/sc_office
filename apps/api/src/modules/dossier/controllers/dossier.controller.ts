import {
  Controller, Get, Post, Delete, Body, Param, Query, Res, UseGuards,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { DossierService } from '../services/dossier.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';

@ApiTags('dossier')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller()
export class DossierController {
  constructor(private readonly service: DossierService) {}

  @Get('employees/:employeeId/dossier')
  @ApiOperation({ summary: 'Obter árvore de pastas do dossiê do funcionário' })
  getFolderTree(@Param('employeeId') employeeId: string) {
    return this.service.getFolderTree(employeeId);
  }

  @Get('employees/:employeeId/dossier/files')
  @ApiOperation({ summary: 'Listar todos os arquivos do dossiê (lista plana)' })
  listAllFiles(@Param('employeeId') employeeId: string) {
    return this.service.listAllFiles(employeeId);
  }

  @Post('employees/:employeeId/dossier/folders')
  @ApiOperation({ summary: 'Criar pasta no dossiê' })
  createFolder(
    @Param('employeeId') employeeId: string,
    @Body('name') name: string,
    @Body('parentId') parentId?: string,
  ) {
    return this.service.createFolder(employeeId, name, parentId);
  }

  @Delete('dossier/folders/:id')
  deleteFolder(@Param('id') id: string) {
    return this.service.deleteFolder(id);
  }

  @Get('dossier/folders/:folderId/contents')
  @ApiOperation({ summary: 'Listar conteúdo de uma pasta' })
  getFolderContents(@Param('folderId') folderId: string) {
    return this.service.getFolderContents(folderId);
  }

  @Post('dossier/folders/:folderId/upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload de arquivo para pasta do dossiê' })
  uploadFile(
    @Param('folderId') folderId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: DocumentType,
    @Body('expiresAt') expiresAt: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.uploadFile(folderId, file, type || DocumentType.OUTRO, userId, expiresAt);
  }

  @Get('dossier/files/:fileId/download')
  @ApiOperation({ summary: 'Download de arquivo do dossiê' })
  async downloadFile(@Param('fileId') fileId: string, @Res() res: Response) {
    const { buffer, mimeType, filename } = await this.service.downloadFile(fileId);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    res.end(buffer);
  }

  @Delete('dossier/files/:fileId')
  deleteFile(@Param('fileId') fileId: string) {
    return this.service.deleteFile(fileId);
  }

  @Post('dossier/files/:fileId/move')
  moveFile(
    @Param('fileId') fileId: string,
    @Body('targetFolderId') targetFolderId: string,
  ) {
    return this.service.moveFile(fileId, targetFolderId);
  }
}
