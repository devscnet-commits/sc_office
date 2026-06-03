import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ComplianceController } from './controllers/compliance.controller';
import { ComplianceService } from './services/compliance.service';
import { ExpirationCheckProcessor } from './jobs/expiration-check.job';
import { ExpirationSchedulerService } from './jobs/expiration-scheduler.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'expiration-check' }),
    AuditModule,
  ],
  controllers: [ComplianceController],
  providers: [ComplianceService, ExpirationCheckProcessor, ExpirationSchedulerService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
