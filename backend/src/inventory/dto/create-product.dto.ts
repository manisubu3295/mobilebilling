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
  brand?: string;       // defaults to "Royal Enfield"

  @IsOptional()
  @IsString()
  partNumber?: string;  // OEM part number, e.g. "500-39A01"

  @IsOptional()
  @IsString()
  compatibleModels?: string; // e.g. "Classic 350, Meteor 350"

  @IsEnum(ProductType)
  type: ProductType;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  hsnCode?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSkuDto)
  skus: CreateSkuDto[];
}
