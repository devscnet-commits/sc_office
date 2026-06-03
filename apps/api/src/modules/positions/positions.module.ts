import { Module } from '@nestjs/common';
import { PositionsController } from './controllers/positions.controller';
import { PositionsService } from './services/positions.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PositionsController],
  providers: [PositionsService],
  exports: [PositionsService],
})
export class PositionsModule {}
