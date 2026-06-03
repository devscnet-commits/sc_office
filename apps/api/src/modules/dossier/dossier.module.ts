import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DossierController } from './controllers/dossier.controller';
import { DossierService } from './services/dossier.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule, MulterModule.register({ storage: memoryStorage() })],
  controllers: [DossierController],
  providers: [DossierService],
  exports: [DossierService],
})
export class DossierModule {}
