import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  FileTypeValidator,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { UserRole, TemplateStatus, TemplateFormat } from '@prisma/client';
import { TemplatesService, CreateTemplateDto, UpdateTemplateDto } from '../services/templates.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';

@ApiTags('templates')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RH)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Criar template (upload DOCX ou HTML)' })
  create(
    @Body() dto: CreateTemplateDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(dto, file, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar templates' })
  findAll(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: TemplateStatus,
    @Query('format') format?: TemplateFormat,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll({ search, category, status, format, page, limit });
  }

  @Get('variables')
  @ApiOperation({ summary: 'Listar todas as variáveis disponíveis' })
  getAvailableVariables() {
    return this.service.getAvailableVariables();
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Get(':id/preview-variables')
  @ApiOperation({ summary: 'Visualizar variáveis do template' })
  previewVariables(@Param('id') id: string) {
    return this.service.previewVariables(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.update(id, dto, file, userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.RH)
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.remove(id, userId);
  }
}
