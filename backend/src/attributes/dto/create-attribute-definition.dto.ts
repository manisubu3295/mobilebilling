import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { AttributeFieldType } from '@prisma/client';

export class CreateAttributeDefinitionDto {
  @IsIn(['PRODUCT', 'CUSTOMER'])
  entityType: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'key must be lowercase snake_case, e.g. "compatible_models"',
  })
  key: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsEnum(AttributeFieldType)
  fieldType: AttributeFieldType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
