import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

// Manually schedules an extra service visit under a warranty that's already
// active — e.g. an unscheduled call-out ahead of the next recurring due date.
// The normal path (approve a warranty, close a job) keeps creating jobs on
// its own; this just lets an admin add one outside that cadence.
export class CreateServiceJobDto {
  @IsString()
  @IsNotEmpty()
  warrantyId: string;

  @IsDateString()
  dueDate: string;
}
