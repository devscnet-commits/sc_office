import {
  Controller, Get, Post, Delete, Patch, Param, Body, Res,
  UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { DocumentType, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { EmployeeDocumentsService } from '../services/employee-documents.service';

@ApiTags('employee-documents')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees/:employeeId/documents')
export class EmployeeDocumentsController {
  constructor(private readonly service: EmployeeDocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar documentos do funcionário' })
  list(@Param('employeeId') employeeId: string) {
    return this.service.list(employeeId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RH)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload de documento pessoal' })
  upload(
    @Param('employeeId') employeeId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: DocumentType,
    @Body('name') name: string,
    @Body('issuedAt') issuedAt?: string,
    @Body('expiresAt') expiresAt?: string,
    @Body('description') description?: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.service.upload(employeeId, file, type, name, userId!, issuedAt, expiresAt, description);
  }

  @Get(':docId/download')
  @ApiOperation({ summary: 'Download de documento' })
  async download(
    @Param('employeeId') employeeId: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const { buffer, mimeType, filename } = await this.service.download(employeeId, docId);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    res.end(buffer);
  }

  @Delete(':docId')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Remover documento' })
  remove(@Param('employeeId') employeeId: string, @Param('docId') docId: string) {
    return this.service.remove(employeeId, docId);
  }

  @Patch(':docId/verify')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Verificar/validar documento' })
  verify(
    @Param('employeeId') employeeId: string,
    @Param('docId') docId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.verify(employeeId, docId, userId);
  }
}
