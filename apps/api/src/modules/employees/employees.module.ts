import { Module } from '@nestjs/common';
import { EmployeesController } from './controllers/employees.controller';
import { EmployeeDocumentsController } from './controllers/employee-documents.controller';
import { EmployeesService } from './services/employees.service';
import { EmployeeDocumentsService } from './services/employee-documents.service';
import { AuditModule } from '../audit/audit.module';
import { MinioModule } from '../../infrastructure/minio/minio.module';

@Module({
  imports: [AuditModule, MinioModule],
  controllers: [EmployeesController, EmployeeDocumentsController],
  providers: [EmployeesService, EmployeeDocumentsService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
