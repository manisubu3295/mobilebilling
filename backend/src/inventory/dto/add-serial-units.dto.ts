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

  // For non-serialized (bulk) SKUs — just increment stockQty by this amount.
  // 0.001 (not 1) so weight/volume/length SKUs can be restocked in fractional
  // amounts — InventoryService rejects non-integer amounts for other units.
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  bulkQty?: number;

  // For serialized SKUs — one entry per physical unit
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SerialUnitDto)
  units?: SerialUnitDto[];
}
