import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentDto } from '../../billing/dto/create-invoice.dto';

export class ConvertQuotationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDto)
  payments: PaymentDto[];
}
