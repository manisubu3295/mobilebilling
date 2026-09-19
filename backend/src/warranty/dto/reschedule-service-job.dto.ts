import { IsDateString } from 'class-validator';

export class RescheduleServiceJobDto {
  @IsDateString()
  dueDate: string;
}
