import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { ConvertQuotationDto } from './dto/convert-quotation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ServiceModuleGuard } from '../common/guards/service-module.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, QuotationStatus } from '@prisma/client';

const BILLING_ROLES = [Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.BILLING_CLERK];

@Controller('quotations')
@UseGuards(JwtAuthGuard, ServiceModuleGuard, RolesGuard)
export class QuotationsController {
  constructor(private quotationsService: QuotationsService) {}

  @Post()
  @Roles(...BILLING_ROLES)
  create(@Body() dto: CreateQuotationDto, @CurrentUser('id') userId: string, @CurrentUser('storeId') storeId: string) {
    return this.quotationsService.createQuotation(dto, userId, storeId);
  }

  @Get()
  @Roles(...BILLING_ROLES)
  list(@CurrentUser('storeId') storeId: string, @Query('status') status?: QuotationStatus) {
    return this.quotationsService.listQuotations(storeId, status);
  }

  @Get(':id')
  @Roles(...BILLING_ROLES)
  get(@Param('id') id: string, @CurrentUser('storeId') storeId: string) {
    return this.quotationsService.getQuotation(id, storeId);
  }

  @Post(':id/convert')
  @Roles(...BILLING_ROLES)
  convert(
    @Param('id') id: string,
    @Body() dto: ConvertQuotationDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('storeId') storeId: string,
  ) {
    return this.quotationsService.convertQuotation(id, storeId, userId, dto);
  }

  @Patch(':id/cancel')
  @Roles(...BILLING_ROLES)
  cancel(@Param('id') id: string, @CurrentUser('storeId') storeId: string) {
    return this.quotationsService.cancelQuotation(id, storeId);
  }
}
