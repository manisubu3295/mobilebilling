import { BadRequestException, Injectable } from '@nestjs/common';
import { AttributeDefinition } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttributeValidatorService {
  constructor(private prisma: PrismaService) {}

  async validate(
    storeId: string,
    entityType: string,
    customFields: Record<string, any> | undefined | null,
  ): Promise<Record<string, any>> {
    const definitions = await this.prisma.attributeDefinition.findMany({
      where: { storeId, entityType, isActive: true },
    });

    const values = customFields ?? {};
    const definedKeys = new Set(definitions.map((d) => d.key));

    for (const key of Object.keys(values)) {
      if (!definedKeys.has(key)) {
        throw new BadRequestException(`Unknown custom field "${key}"`);
      }
    }

    const sanitized: Record<string, any> = {};
    for (const def of definitions) {
      const value = values[def.key];
      const isEmpty = value === undefined || value === null || value === '';

      if (isEmpty) {
        if (def.required) {
          throw new BadRequestException(`"${def.label}" is required`);
        }
        continue;
      }

      sanitized[def.key] = this.coerce(def, value);
    }

    return sanitized;
  }

  private coerce(def: AttributeDefinition, value: any): any {
    const options = Array.isArray(def.options) ? (def.options as string[]) : null;

    switch (def.fieldType) {
      case 'TEXT':
        if (typeof value !== 'string') {
          throw new BadRequestException(`"${def.label}" must be text`);
        }
        return value;

      case 'NUMBER': {
        const num = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(num)) {
          throw new BadRequestException(`"${def.label}" must be a number`);
        }
        return num;
      }

      case 'BOOLEAN':
        if (typeof value !== 'boolean') {
          throw new BadRequestException(`"${def.label}" must be true or false`);
        }
        return value;

      case 'DATE': {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          throw new BadRequestException(`"${def.label}" must be a valid date`);
        }
        return date.toISOString();
      }

      case 'SELECT':
        if (typeof value !== 'string' || (options && !options.includes(value))) {
          throw new BadRequestException(`"${def.label}" must be one of: ${options?.join(', ')}`);
        }
        return value;

      case 'MULTISELECT':
        if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
          throw new BadRequestException(`"${def.label}" must be a list of values`);
        }
        if (options) {
          const invalid = value.filter((v) => !options.includes(v));
          if (invalid.length) {
            throw new BadRequestException(
              `"${def.label}" contains invalid values: ${invalid.join(', ')}`,
            );
          }
        }
        return value;

      default:
        return value;
    }
  }
}
