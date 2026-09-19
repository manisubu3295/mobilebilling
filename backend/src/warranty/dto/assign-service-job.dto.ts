import { IsNotEmpty, IsString } from 'class-validator';

export class AssignServiceJobDto {
  @IsString()
  @IsNotEmpty()
  assignedToId: string;
}
