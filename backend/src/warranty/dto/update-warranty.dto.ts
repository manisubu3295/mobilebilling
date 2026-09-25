import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';
import { ServiceFrequency } from '@prisma/client';

// Admin edit of an AMC / warranty — every field optional.
export class UpdateWarrantyDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  warrantyPeriodMonths?: number;

  @IsOptional()
  @IsEnum(ServiceFrequency)
  serviceFrequency?: ServiceFrequency;

  // Months between visits when serviceFrequency is CUSTOM.
  @IsOptional()
  @IsInt()
  @Min(1)
  frequencyMonths?: number;

  @ValidateIf((o) => o.amcFrom !== undefined && o.amcFrom !== null && o.amcFrom !== '')
  @IsDateString()
  amcFrom?: string | null;

  @ValidateIf((o) => o.amcTo !== undefined && o.amcTo !== null && o.amcTo !== '')
  @IsDateString()
  amcTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  // Move the next open regular visit to match the new start date / frequency.
  @IsOptional()
  @IsBoolean()
  recalcNextDue?: boolean;
}
