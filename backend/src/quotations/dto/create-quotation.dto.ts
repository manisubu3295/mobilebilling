import { IsArray, IsBoolean, IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class QuotationItemDto {
  @IsString()
  @IsNotEmpty()
  skuId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class CreateQuotationDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemDto)
  items: QuotationItemDto[];

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

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  // Defaults to true so behavior matches invoices when the toggle isn't shown.
  @IsOptional()
  @IsBoolean()
  gstApplied?: boolean;
}
