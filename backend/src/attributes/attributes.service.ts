import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttributeDefinitionDto } from './dto/create-attribute-definition.dto';
import { UpdateAttributeDefinitionDto } from './dto/update-attribute-definition.dto';

@Injectable()
export class AttributesService {
  constructor(private prisma: PrismaService) {}

  async create(storeId: string, dto: CreateAttributeDefinitionDto) {
    try {
      return await this.prisma.attributeDefinition.create({
        data: {
          storeId,
          entityType: dto.entityType,
          key: dto.key,
          label: dto.label,
          fieldType: dto.fieldType,
          options: dto.options ?? undefined,
          required: dto.required ?? false,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException(
          `An attribute with key "${dto.key}" already exists for this entity type`,
        );
      }
      throw err;
    }
  }

  async list(storeId: string, entityType: string) {
    return this.prisma.attributeDefinition.findMany({
      where: { storeId, entityType, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async update(storeId: string, id: string, dto: UpdateAttributeDefinitionDto) {
    const existing = await this.prisma.attributeDefinition.findFirst({ where: { id, storeId } });
    if (!existing) throw new NotFoundException('Attribute definition not found');

    return this.prisma.attributeDefinition.update({
      where: { id },
      data: {
        label: dto.label,
        options: dto.options ?? undefined,
        required: dto.required,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  async archive(storeId: string, id: string) {
    const existing = await this.prisma.attributeDefinition.findFirst({ where: { id, storeId } });
    if (!existing) throw new NotFoundException('Attribute definition not found');

    return this.prisma.attributeDefinition.update({ where: { id }, data: { isActive: false } });
  }
}
