import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ServiceFrequency } from '@prisma/client';

export class ApproveWarrantyDto {
  @IsInt()
  @Min(1)
  warrantyPeriodMonths: number;

  @IsEnum(ServiceFrequency)
  serviceFrequency: ServiceFrequency;

  // Months between visits when serviceFrequency is CUSTOM.
  @IsOptional()
  @IsInt()
  @Min(1)
  frequencyMonths?: number;
}
