import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class AddServiceJobPartDto {
  @IsString()
  @IsNotEmpty()
  skuId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;
}
