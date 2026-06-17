import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  IsIn,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMode } from '@prisma/client';

export class InvoiceItemDto {
  @IsString()
  @IsNotEmpty()
  skuId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  // For serialized items: provide IMEI or serial number
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialIds?: string[]; // IDs from serial_inventory table

  @IsOptional()
  @Matches(/^\d{15}$/, { message: 'IMEI must be exactly 15 digits' })
  imei1?: string;

  @IsOptional()
  @Matches(/^\d{15}$/, { message: 'IMEI must be exactly 15 digits' })
  imei2?: string;
}

export class PaymentDto {
  @IsEnum(PaymentMode)
  mode: PaymentMode;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreateInvoiceDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDto)
  payments: PaymentDto[];

  @IsOptional()
  @IsIn(['PERCENT', 'FLAT'])
  discountType?: 'PERCENT' | 'FLAT';

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountValue?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  // Required when discount > 15% - manager OTP verification token
  @IsOptional()
  @IsString()
  managerOtpToken?: string;
}
