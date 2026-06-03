import { Module } from '@nestjs/common';
import { CustomFieldsController } from './controllers/custom-fields.controller';
import { CustomFieldsService } from './services/custom-fields.service';

@Module({
  controllers: [CustomFieldsController],
  providers: [CustomFieldsService],
  exports: [CustomFieldsService],
})
export class CustomFieldsModule {}
