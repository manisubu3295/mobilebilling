import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AttributesService } from './attributes.service';
import { CreateAttributeDefinitionDto } from './dto/create-attribute-definition.dto';
import { UpdateAttributeDefinitionDto } from './dto/update-attribute-definition.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('attributes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttributesController {
  constructor(private attributesService: AttributesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER)
  create(@CurrentUser('storeId') storeId: string, @Body() dto: CreateAttributeDefinitionDto) {
    return this.attributesService.create(storeId, dto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.BILLING_CLERK, Role.INVENTORY_MANAGER)
  list(@CurrentUser('storeId') storeId: string, @Query('entityType') entityType: string) {
    return this.attributesService.list(storeId, entityType);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER)
  update(
    @CurrentUser('storeId') storeId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAttributeDefinitionDto,
  ) {
    return this.attributesService.update(storeId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER)
  archive(@CurrentUser('storeId') storeId: string, @Param('id') id: string) {
    return this.attributesService.archive(storeId, id);
  }
}
