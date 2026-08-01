import { Module } from '@nestjs/common';
import { AttributesController } from './attributes.controller';
import { AttributesService } from './attributes.service';
import { AttributeValidatorService } from './attribute-validator.service';

@Module({
  controllers: [AttributesController],
  providers: [AttributesService, AttributeValidatorService],
  exports: [AttributesService, AttributeValidatorService],
})
export class AttributesModule {}
