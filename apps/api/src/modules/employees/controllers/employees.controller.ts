import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { EmployeesService } from '../services/employees.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  EmployeeFilterDto,
} from '../dto/create-employee.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';

@ApiTags('employees')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Cadastrar novo funcionário' })
  create(@Body() dto: CreateEmployeeDto, @CurrentUser('id') userId: string) {
    return this.employeesService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar funcionários com filtros e paginação' })
  findAll(@Query() filter: EmployeeFilterDto) {
    return this.employeesService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar funcionário por ID' })
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.RH)
  @ApiOperation({ summary: 'Atualizar funcionário' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.employeesService.update(id, dto, userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Remover funcionário (soft delete)' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.employeesService.remove(id, userId);
  }

  @Get(':id/variables')
  @ApiOperation({ summary: 'Obter variáveis do funcionário para templates' })
  getVariables(@Param('id') id: string) {
    return this.employeesService.getVariables(id);
  }
}
