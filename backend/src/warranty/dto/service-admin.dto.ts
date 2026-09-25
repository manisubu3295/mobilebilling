import {
  IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateIf,
} from 'class-validator';
import { ServiceCategory } from '@prisma/client';

// A technician asking for a visit under one of the customer's active AMCs.
// It waits as REQUESTED until an admin approves or rejects it.
export class CreateServiceRequestDto {
  @IsString()
  @IsNotEmpty()
  warrantyId: string;

  @IsDateString()
  preferredDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ApproveServiceRequestDto {
  // Defaults to the date the technician asked for.
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  // Defaults to the technician who asked.
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectServiceRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

// Admin correction of any visit: every field optional, null clears it.
const optionalNullable = (key: string) => ValidateIf((o) => o[key] !== undefined && o[key] !== null);

export class AdminUpdateServiceJobDto {
  @IsOptional() @IsDateString() dueDate?: string;

  @optionalNullable('assignedToId') @IsString() assignedToId?: string | null;

  @optionalNullable('serviceCategory') @IsEnum(ServiceCategory) serviceCategory?: ServiceCategory | null;

  @optionalNullable('visitDate') @IsDateString() visitDate?: string | null;

  @optionalNullable('customerFeedback') @IsString() @MaxLength(1000) customerFeedback?: string | null;

  @optionalNullable('customerChargeAmount') @IsNumber() @Min(0) customerChargeAmount?: number | null;
  @optionalNullable('customerChargeNotes') @IsString() @MaxLength(300) customerChargeNotes?: string | null;

  @optionalNullable('staffExpenseAmount') @IsNumber() @Min(0) staffExpenseAmount?: number | null;
  @optionalNullable('staffExpenseNotes') @IsString() @MaxLength(300) staffExpenseNotes?: string | null;

  // Put a closed (completed/cancelled) visit back to open.
  @IsOptional() @IsBoolean() reopen?: boolean;
}

export class AdminCreateServiceJobDto {
  @IsString()
  @IsNotEmpty()
  warrantyId: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  // Extra visit outside the regular cycle (closing it won't schedule the next one).
  @IsOptional()
  @IsBoolean()
  isExtra?: boolean;

  @IsOptional()
  @IsEnum(ServiceCategory)
  serviceCategory?: ServiceCategory;
}

export class CustomMonthsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  frequencyMonths?: number;
}
