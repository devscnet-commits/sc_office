import {
  Controller, Get, Post, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ComplianceService } from '../services/compliance.service';
import { ExpirationSchedulerService } from '../jobs/expiration-scheduler.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import {
  BulkRequirementsDto, CreateRequirementDto, SetValidityDto,
} from '../dto/compliance.dto';

@ApiTags('compliance')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ComplianceController {
  constructor(
    private readonly compliance: ComplianceService,
    private readonly scheduler: ExpirationSchedulerService,
  ) {}

  // ============================================================
  // TEMPLATE REQUIREMENTS
  // ============================================================

  @Get('templates/:id/requirements')
  @ApiOperation({ summary: 'Listar requisitos de documentos do template' })
  getRequirements(@Param('id') id: string) {
    return this.compliance.getRequirements(id);
  }

  @Post('templates/:id/requirements')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Adicionar requisito ao template' })
  addRequirement(@Param('id') id: string, @Body() dto: CreateRequirementDto) {
    return this.compliance.addRequirement(id, dto);
  }

  @Post('templates/:id/requirements/bulk')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Definir todos os requisitos do template (substitui existentes)' })
  setRequirements(@Param('id') id: string, @Body() dto: BulkRequirementsDto) {
    return this.compliance.setRequirements(id, dto.requirements);
  }

  @Delete('templates/requirements/:requirementId')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover requisito do template' })
  removeRequirement(@Param('requirementId') requirementId: string) {
    return this.compliance.removeRequirement(requirementId);
  }

  // ============================================================
  // COMPLIANCE CHECK (pre-generation validation)
  // ============================================================

  @Get('compliance/check')
  @ApiOperation({
    summary: 'Validar compliance antes de gerar documento',
    description: 'Verifica se o funcionário possui todos os documentos exigidos pelo template',
  })
  @ApiResponse({
    status: 200,
    description: '{ canGenerate: boolean, requirements: [...], blockerCount: number }',
  })
  checkCompliance(
    @Query('templateId') templateId: string,
    @Query('employeeId') employeeId: string,
  ) {
    return this.compliance.checkCompliance(templateId, employeeId);
  }

  // ============================================================
  // DOCUMENT VALIDITY
  // ============================================================

  @Post('employees/:employeeId/validity')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Registrar/atualizar validade de documento do funcionário' })
  setValidity(@Param('employeeId') employeeId: string, @Body() dto: SetValidityDto) {
    return this.compliance.setValidity(employeeId, dto);
  }

  @Get('employees/:employeeId/validity')
  @ApiOperation({ summary: 'Obter validade de todos os documentos do funcionário' })
  getValidity(@Param('employeeId') employeeId: string) {
    return this.compliance.getEmployeeValidity(employeeId);
  }

  // ============================================================
  // PENDENCIES
  // ============================================================

  @Get('employees/:employeeId/pendencies')
  @ApiOperation({ summary: 'Listar pendências do funcionário (central de pendências)' })
  getPendencies(@Param('employeeId') employeeId: string) {
    return this.compliance.getEmployeePendencies(employeeId);
  }

  // ============================================================
  // HEALTH SCORE
  // ============================================================

  @Get('employees/:employeeId/health-score')
  @ApiOperation({ summary: 'Health score do funcionário (cadastro + docs + compliance)' })
  getHealthScore(@Param('employeeId') employeeId: string) {
    return this.compliance.getHealthScore(employeeId);
  }

  @Get('compliance/health-scores')
  @ApiOperation({ summary: 'Health scores de todos os funcionários ativos' })
  getHealthScoreList(
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
  ) {
    return this.compliance.getHealthScoreList({ departmentId, status });
  }

  // ============================================================
  // EXPIRATION DASHBOARD
  // ============================================================

  @Get('compliance/expiration-dashboard')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Dashboard de vencimentos: vencidos, críticos, próximos' })
  getExpirationDashboard() {
    return this.compliance.getExpirationDashboard();
  }

  // ============================================================
  // ADMIN: TRIGGER MANUAL JOB
  // ============================================================

  @Post('compliance/jobs/trigger-expiration-check')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Disparar verificação de vencimentos manualmente' })
  triggerExpirationCheck() {
    return this.scheduler.triggerNow();
  }
}
