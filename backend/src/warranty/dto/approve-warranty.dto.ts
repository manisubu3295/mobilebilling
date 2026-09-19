import { IsEnum, IsInt, Min } from 'class-validator';
import { ServiceFrequency } from '@prisma/client';

export class ApproveWarrantyDto {
  @IsInt()
  @Min(1)
  warrantyPeriodMonths: number;

  @IsEnum(ServiceFrequency)
  serviceFrequency: ServiceFrequency;
}
