import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CompanyService } from '../services/company.service';

@ApiTags('company')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('company')
export class CompanyController {
  constructor(private readonly service: CompanyService) {}
  @Get() get() { return this.service.get(); }
  @Put() upsert(@Body() data: any) { return this.service.upsert(data); }
}
