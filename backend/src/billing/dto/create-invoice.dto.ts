import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  IsIn,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BillType, PaymentMode, ServiceCategory } from '@prisma/client';

export class InvoiceItemDto {
  // Omitted for a free-typed line (service bills: "IRF media changed",
  // "Service charges") — those are billed against the store's non-stock
  // service-charge SKU and need description + unitPrice instead.
  @ValidateIf((o) => !o.description)
  @IsString()
  @IsNotEmpty()
  skuId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  // Price before GST. Only honoured on service bills and free-typed lines —
  // counter sales always bill at the SKU's selling price.
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  // GST % for a free-typed line (defaults to the service-charge SKU's rate).
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  // 0.001 (not 1) so weight/volume/length units (KG, LITER, METER) can be sold
  // in fractional amounts — BillingService rejects non-integer quantities for
  // any other unit, since @Min here has no knowledge of which SKU this is.
  @IsNumber()
  @Min(0.001)
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

  // Per-invoice GST override (service-module feature). Defaults to true so
  // existing tenants without the toggle in their UI keep today's behavior.
  @IsOptional()
  @IsBoolean()
  gstApplied?: boolean;

  @IsOptional()
  @IsEnum(BillType)
  billType?: BillType;

  // Typed-in bill number (entering an existing paper bill). Left out, the
  // next number in the bill's series is used.
  @IsOptional()
  @IsString()
  @MaxLength(30)
  billNo?: string;

  @IsOptional()
  @IsEnum(ServiceCategory)
  serviceCategory?: ServiceCategory;

  @IsOptional()
  @IsString()
  technicianId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  tdsRaw?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  tdsTreated?: string;
}

export class UpdateBillNoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  billNo: string;
}
