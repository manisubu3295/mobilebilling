import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { WebsiteModuleGuard } from '../common/guards/website-module.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, LeadStatus } from '@prisma/client';
import { WebsiteService } from './website.service';
import { CreateWebsiteProductDto } from './dto/create-website-product.dto';
import { UpdateWebsiteProductDto } from './dto/update-website-product.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateWebsiteCategoryDto, UpdateWebsiteCategoryDto } from './dto/website-category.dto';

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.STORE_MANAGER];

@Controller()
@UseGuards(JwtAuthGuard, WebsiteModuleGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class WebsiteAdminController {
  constructor(private websiteService: WebsiteService) {}

  @Get('website-products')
  listProducts(@CurrentUser('storeId') storeId: string) {
    return this.websiteService.listProducts(storeId);
  }

  @Post('website-products')
  createProduct(@Body() dto: CreateWebsiteProductDto, @CurrentUser('storeId') storeId: string) {
    return this.websiteService.createProduct(storeId, dto);
  }

  @Patch('website-products/:id')
  updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateWebsiteProductDto,
    @CurrentUser('storeId') storeId: string,
  ) {
    return this.websiteService.updateProduct(id, storeId, dto);
  }

  @Delete('website-products/:id')
  deleteProduct(@Param('id') id: string, @CurrentUser('storeId') storeId: string) {
    return this.websiteService.deleteProduct(id, storeId);
  }

  @Get('website-categories')
  listCategories(@CurrentUser('storeId') storeId: string) {
    return this.websiteService.listCategories(storeId);
  }

  @Post('website-categories')
  createCategory(@Body() dto: CreateWebsiteCategoryDto, @CurrentUser('storeId') storeId: string) {
    return this.websiteService.createCategory(storeId, dto);
  }

  @Post('website-categories/load-defaults')
  loadDefaultCategories(@CurrentUser('storeId') storeId: string) {
    return this.websiteService.loadDefaultCategories(storeId);
  }

  @Patch('website-categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateWebsiteCategoryDto,
    @CurrentUser('storeId') storeId: string,
  ) {
    return this.websiteService.updateCategory(id, storeId, dto);
  }

  @Delete('website-categories/:id')
  deleteCategory(@Param('id') id: string, @CurrentUser('storeId') storeId: string) {
    return this.websiteService.deleteCategory(id, storeId);
  }

  @Get('leads')
  listLeads(@CurrentUser('storeId') storeId: string, @Query('status') status?: LeadStatus) {
    return this.websiteService.listLeads(storeId, status);
  }

  @Patch('leads/:id')
  updateLead(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser('storeId') storeId: string,
  ) {
    return this.websiteService.updateLead(id, storeId, dto);
  }
}
