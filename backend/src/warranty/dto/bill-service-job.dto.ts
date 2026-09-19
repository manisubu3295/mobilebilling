import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentDto } from '../../billing/dto/create-invoice.dto';

// Turns a service job's already-recorded customerChargeAmount into a real
// GST invoice + payment(s) — the amount itself comes from the job (set via
// Save Progress / Close Visit), this only says how it was paid.
export class BillServiceJobDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDto)
  payments: PaymentDto[];
}
