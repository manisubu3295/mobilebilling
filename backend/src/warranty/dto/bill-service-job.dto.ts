import { IsArray, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { ServiceCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import { PaymentDto } from '../../billing/dto/create-invoice.dto';

// Turns a service job's already-recorded customerChargeAmount into a real
// GST invoice + payment(s) — the amount itself comes from the job (set via
// Save Progress / Close Visit), this only says how it was paid.
export class BillServiceJobDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDto)
  payments: PaymentDto[];

  // Paper service-bill number, when the technician already wrote one out;
  // left out, the next SERVICE series number is used.
  @IsOptional()
  @IsString()
  @MaxLength(30)
  billNo?: string;

  @IsOptional()
  @IsEnum(ServiceCategory)
  serviceCategory?: ServiceCategory;
}
