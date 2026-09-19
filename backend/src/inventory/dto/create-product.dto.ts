import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductType } from '@prisma/client';

export class CreateSkuDto {
  @IsString()
  @IsNotEmpty()
  variantName: string;   // e.g. "Standard", "BS6", "OEM Chrome"

  @IsOptional()
  @IsString()
  unit?: string;         // PCS, SET, LITER, PAIR — defaults to PCS

  @IsOptional()
  @IsBoolean()
  isSerialized?: boolean; // true = serial-tracked, false = bulk qty

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQty?: number;     // initial stock for bulk parts

  @IsNumber()
  @Min(0)
  costPrice: number;

  @IsNumber()
  @Min(0)
  sellingPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  barcode?: string;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  partNumber?: string;  // manufacturer part/SKU number

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  hsnCode?: string;

  // Service module: opt this product into the warranty/service-job workflow
  // when it's sold (e.g. water purifiers, not accessories/consumables).
  @IsOptional()
  @IsBoolean()
  requiresService?: boolean;

  // PHYSICAL (default) = a stocked good. SERVICE = a billable line item with
  // no physical stock (labor, visit fees…) — always sellable, no stock checks.
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  // Business-defined fields (e.g. compatible models for a bike shop) — see the
  // attributes module for how a store defines which keys are available here.
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSkuDto)
  skus: CreateSkuDto[];
}
