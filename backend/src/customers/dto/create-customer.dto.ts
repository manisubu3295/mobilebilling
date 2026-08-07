import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @Matches(/^[0-9+\-\s]{7,15}$/, { message: 'Invalid phone number' })
  phone: string;

  // @IsOptional() alone only skips validation for undefined/null — an empty
  // string (what the "New Customer" form sends when the field is left blank)
  // would still hit @IsEmail() and fail. Only validate the format when a
  // non-empty value was actually entered.
  @ValidateIf((dto) => dto.email !== undefined && dto.email !== null && dto.email !== '')
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
