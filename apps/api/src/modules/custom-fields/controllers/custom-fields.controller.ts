import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CustomFieldsService } from '../services/custom-fields.service';
import {
  CreateCustomFieldDto,
  SetCustomFieldValueDto,
  BulkSetCustomFieldValuesDto,
} from '../dto/custom-field.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';

@ApiTags('custom-fields')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CustomFieldsController {
  constructor(private readonly service: CustomFieldsService) {}

  // Field definitions
  @Post('custom-fields')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Criar campo customizado (ex: numero_calcado → {{custom.numero_calcado}})' })
  create(@Body() dto: CreateCustomFieldDto) {
    return this.service.create(dto);
  }

  @Get('custom-fields')
  @ApiOperation({ summary: 'Listar campos customizados' })
  findAll(@Query('includeInactive') includeInactive?: boolean) {
    return this.service.findAll(includeInactive);
  }

  @Get('custom-fields/variables')
  @ApiOperation({ summary: 'Listar variáveis customizadas disponíveis para templates' })
  getVariables() {
    return this.service.getAvailableVariables();
  }

  @Get('custom-fields/:id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put('custom-fields/:id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: Partial<CreateCustomFieldDto>) {
    return this.service.update(id, dto);
  }

  @Delete('custom-fields/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }

  // Employee values
  @Get('employees/:employeeId/custom-fields')
  @ApiOperation({ summary: 'Obter valores de campos customizados do funcionário' })
  getEmployeeValues(@Param('employeeId') employeeId: string) {
    return this.service.getEmployeeValues(employeeId);
  }

  @Post('employees/:employeeId/custom-fields')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Salvar valor de campo customizado para funcionário' })
  setEmployeeValue(
    @Param('employeeId') employeeId: string,
    @Body() dto: SetCustomFieldValueDto,
  ) {
    return this.service.setEmployeeValue(employeeId, dto);
  }

  @Post('employees/:employeeId/custom-fields/bulk')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Salvar múltiplos campos customizados do funcionário' })
  bulkSetEmployeeValues(
    @Param('employeeId') employeeId: string,
    @Body() dto: BulkSetCustomFieldValuesDto,
  ) {
    return this.service.bulkSetEmployeeValues(employeeId, dto);
  }
}
