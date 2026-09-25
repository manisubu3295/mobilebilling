import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { ServiceCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import { PaymentDto } from '../../billing/dto/create-invoice.dto';

// Turns a service job's already-recorded customerChargeAmount into a real
// GST invoice + payment(s) — the amount itself comes from the job (set via
// Save Progress / Close Visit), this only says how it was paid.
// Extra typed line added on the Service Bill page when billing a job
// (e.g. "Re-installation charges", "IRF media changed"). Price is before GST.
export class ServiceBillExtraLineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  description: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;
}

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceBillExtraLineDto)
  extraLines?: ServiceBillExtraLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(30)
  tdsRaw?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  tdsTreated?: string;

  // Left out = GST applied if any line carries a tax rate (previous behaviour).
  @IsOptional()
  @IsBoolean()
  gstApplied?: boolean;
}
