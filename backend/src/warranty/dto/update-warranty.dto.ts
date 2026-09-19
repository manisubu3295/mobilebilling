import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ServiceFrequency } from '@prisma/client';

export class UpdateWarrantyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  warrantyPeriodMonths?: number;

  @IsOptional()
  @IsEnum(ServiceFrequency)
  serviceFrequency?: ServiceFrequency;
}
