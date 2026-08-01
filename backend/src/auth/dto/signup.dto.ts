import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class SignupDto {
  @IsString()
  @MinLength(2)
  businessName: string;

  @IsString()
  @MinLength(2)
  ownerName: string;

  @IsEmail()
  email: string;

  @Matches(/^[0-9+][0-9+\-\s]{7,14}$/, { message: 'phone must be a valid phone number' })
  phone: string;

  @IsString()
  @MinLength(8)
  password: string;
}
