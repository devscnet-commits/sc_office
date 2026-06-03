import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TemplatesController } from './controllers/templates.controller';
import { TemplatesService } from './services/templates.service';
import { TemplateEngineService } from './engines/template-engine.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    AuditModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService, TemplateEngineService],
  exports: [TemplatesService, TemplateEngineService],
})
export class TemplatesModule {}
