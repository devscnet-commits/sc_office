import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DocumentsController } from './controllers/documents.controller';
import { DocumentsService } from './services/documents.service';
import { PdfProcessor } from './services/pdf.processor';
import { TemplatesModule } from '../templates/templates.module';
import { EmployeesModule } from '../employees/employees.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'pdf-generation' }),
    TemplatesModule,
    EmployeesModule,
    AuditModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, PdfProcessor],
  exports: [DocumentsService],
})
export class DocumentsModule {}
