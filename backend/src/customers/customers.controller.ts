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
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
// SERVICE_STAFF can look up and add customers so technicians can raise
// service bills themselves; editing/deactivating stays with office roles.
@Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.BILLING_CLERK, Role.SERVICE_STAFF)
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Post()
  create(@Body() dto: CreateCustomerDto, @CurrentUser('storeId') storeId: string) {
    return this.customersService.create(dto, storeId);
  }

  @Post('assign-card-numbers')
  @Roles(Role.SUPER_ADMIN)
  assignCardNumbers(@CurrentUser('storeId') storeId: string) {
    return this.customersService.assignMissingCardNumbers(storeId);
  }

  @Get()
  findAll(@Query('search') search?: string, @Query('includeInactive') includeInactive?: string) {
    return this.customersService.findAll(search, includeInactive === 'true');
  }

  @Get('next-card-no')
  nextCardNo(@CurrentUser('storeId') storeId: string) {
    return this.customersService.nextCardNo(storeId);
  }

  @Get(':id/history')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.BILLING_CLERK)
  history(@Param('id') id: string) {
    return this.customersService.history(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.BILLING_CLERK)
  update(@Param('id') id: string, @Body() dto: Partial<CreateCustomerDto>) {
    return this.customersService.update(id, dto);
  }

  @Patch(':id/toggle')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.BILLING_CLERK)
  toggleActive(@Param('id') id: string) {
    return this.customersService.toggleActive(id);
  }
}
