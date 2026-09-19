import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateLeadDto {
  @IsOptional()
  @IsIn(['NEW', 'CONTACTED', 'QUOTED', 'CONVERTED', 'CLOSED'])
  status?: 'NEW' | 'CONTACTED' | 'QUOTED' | 'CONVERTED' | 'CLOSED';

  @IsOptional()
  @IsString()
  notes?: string;
}
