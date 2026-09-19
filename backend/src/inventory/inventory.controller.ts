import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { AddSerialUnitsDto } from './dto/add-serial-units.dto';
import { UpdateProductDto, UpdateSkuDto } from './dto/update-product.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Post('products')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.INVENTORY_MANAGER)
  createProduct(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: any,
  ) {
    return this.inventoryService.createProduct(dto, user.id, user.storeId);
  }

  @Get('products')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.BILLING_CLERK, Role.INVENTORY_MANAGER)
  listProducts(
    @CurrentUser('storeId') storeId: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('lowStock') lowStock?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.inventoryService.listProducts(storeId, {
      search,
      categoryId,
      lowStock: lowStock === 'true',
      includeInactive: includeInactive === 'true',
    });
  }

  @Get('products/:id')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.BILLING_CLERK, Role.INVENTORY_MANAGER)
  getProduct(@Param('id') id: string, @CurrentUser('storeId') storeId: string) {
    return this.inventoryService.getProduct(id, storeId);
  }

  @Put('products/:id')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.INVENTORY_MANAGER)
  updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser('storeId') storeId: string,
  ) {
    return this.inventoryService.updateProduct(id, dto, storeId);
  }

  @Patch('products/:id/toggle')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.INVENTORY_MANAGER)
  toggleProductActive(@Param('id') id: string, @CurrentUser('storeId') storeId: string) {
    return this.inventoryService.toggleProductActive(id, storeId);
  }

  @Put('skus/:id')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.INVENTORY_MANAGER)
  updateSku(
    @Param('id') id: string,
    @Body() dto: UpdateSkuDto,
    @CurrentUser('storeId') storeId: string,
  ) {
    return this.inventoryService.updateSku(id, dto, storeId);
  }

  @Post('serial-units')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.INVENTORY_MANAGER)
  addSerialUnits(
    @Body() dto: AddSerialUnitsDto,
    @CurrentUser() user: any,
  ) {
    return this.inventoryService.addSerialUnits(dto, user.id, user.storeId);
  }

  @Get('serial-units')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.BILLING_CLERK, Role.INVENTORY_MANAGER)
  listSerialUnits(
    @CurrentUser('storeId') storeId: string,
    @Query('status') status?: string,
    @Query('skuId') skuId?: string,
  ) {
    return this.inventoryService.listSerialUnits(storeId, { status, skuId });
  }

  @Get('low-stock')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.INVENTORY_MANAGER)
  getLowStockAlerts(@CurrentUser('storeId') storeId: string) {
    return this.inventoryService.getLowStockAlerts(storeId);
  }

  @Put('skus/:id/price')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER)
  updateSkuPrice(
    @Param('id') id: string,
    @Body() body: { sellingPrice: number; costPrice?: number },
    @CurrentUser() user: any,
  ) {
    return this.inventoryService.updatePrice(id, body, user.id, user.storeId);
  }

  @Get('categories')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.BILLING_CLERK, Role.INVENTORY_MANAGER)
  listCategories() {
    return this.inventoryService.listCategories();
  }

  @Post('categories')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.INVENTORY_MANAGER)
  createCategory(@Body() body: { name: string }) {
    return this.inventoryService.createCategory(body.name);
  }

  @Post('products/import')
  @HttpCode(200)
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.INVENTORY_MANAGER)
  importProducts(@Body() body: { rows: any[] }, @CurrentUser() user: any) {
    return this.inventoryService.importProducts(body.rows, user.id, user.storeId);
  }
}
