import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { ServiceFrequency } from '@prisma/client';

// Registers an AMC/warranty directly against a customer + product, with no
// sale/invoice involved — for a pre-existing customer (bought elsewhere, or
// before this system was in use) the business wants on the service schedule.
export class CreateStandaloneWarrantyDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  productId: string;

  // Purchase/install date — defaults to today when omitted.
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
}
