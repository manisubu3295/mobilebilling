import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString, Matches } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @Matches(/^[0-9+\-\s]{7,15}$/, { message: 'Invalid phone number' })
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  // Business-defined fields (e.g. vehicle no, RE model for a bike shop) — see the
  // attributes module for how a store defines which keys are available here.
  @IsOptional()
  @IsObject()
  customFields?: Record<string, any>;
}
