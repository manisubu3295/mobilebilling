import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// Used both for a plain staff update (save-in-progress notes) and for closing a
// job (same fields, the close endpoint additionally stamps status+closedAt).
export class UpdateServiceJobDto {
  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @IsOptional()
  @IsString()
  customerFeedback?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  staffExpenseAmount?: number;

  @IsOptional()
  @IsString()
  staffExpenseNotes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  customerChargeAmount?: number;

  @IsOptional()
  @IsString()
  customerChargeNotes?: string;
}
