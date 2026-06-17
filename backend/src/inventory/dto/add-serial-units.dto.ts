import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SerialUnitDto {
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  batchNumber?: string;  // batch / lot number for traceability
}

export class AddSerialUnitsDto {
  @IsString()
  @IsNotEmpty()
  skuId: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  purchasedAt?: string;

  // For non-serialized (bulk) SKUs — just increment stockQty by this amount
  @IsOptional()
  @IsNumber()
  @Min(1)
  bulkQty?: number;

  // For serialized SKUs — one entry per physical unit
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SerialUnitDto)
  units?: SerialUnitDto[];
}
