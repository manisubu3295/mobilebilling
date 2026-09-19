import { IsBoolean, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { AccountStatus } from '../../../generated/master-client';

export class UpdateAccountDto {
  @IsOptional()
  @IsDateString()
  licenseExpiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  serviceModuleEnabled?: boolean;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;
}
