import { IsEmail, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  smtpPort?: number;

  @IsOptional()
  @IsString()
  smtpUser?: string;

  // Only overwrites the stored password if a non-empty value is sent — leaving this
  // blank in the UI keeps whatever password is already saved.
  @IsOptional()
  @IsString()
  smtpPass?: string;

  @IsOptional()
  @IsString()
  smtpFrom?: string;

  @IsOptional()
  @IsEmail()
  adminNotifyEmail?: string;
}
