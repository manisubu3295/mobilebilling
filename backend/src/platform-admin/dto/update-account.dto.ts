import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { AccountStatus } from '../../../generated/master-client';

export class UpdateAccountDto {
  @IsOptional()
  @IsDateString()
  licenseExpiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  serviceModuleEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  websiteEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'siteKey may only contain lowercase letters, numbers and hyphens' })
  siteKey?: string | null;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;
}
