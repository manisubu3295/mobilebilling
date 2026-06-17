import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@SkipThrottle()
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Post('invoices')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.BILLING_CLERK)
  createInvoice(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.billingService.createInvoice(dto, user.id, user.storeId, user.role, req.ip);
  }

  @Get('invoices')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.BILLING_CLERK)
  listInvoices(
    @CurrentUser('storeId') storeId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.billingService.listInvoices(storeId, +page, +limit, search, from, to, status);
  }

  @Get('invoices/:id')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.BILLING_CLERK)
  getInvoice(@Param('id') id: string, @CurrentUser('storeId') storeId: string) {
    return this.billingService.getInvoice(id, storeId);
  }

  @Patch('invoices/:id/cancel')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER)
  cancelInvoice(@Param('id') id: string, @CurrentUser() user: any) {
    return this.billingService.cancelInvoice(id, user.id, user.storeId);
  }

  @Patch('invoices/:id/return-items')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER)
  returnItems(
    @Param('id') id: string,
    @Body() body: { returns: Array<{ itemId: string; qty: number }> },
    @CurrentUser() user: any,
  ) {
    return this.billingService.returnInvoiceItems(id, body.returns, user.id, user.storeId);
  }

  // Unified part lookup: tries barcode → part number → serial number
  @Get('lookup/search')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER, Role.BILLING_CLERK)
  lookupPart(@Query('q') query: string, @CurrentUser('storeId') storeId: string) {
    return this.billingService.lookupPart(query, storeId);
  }

  @Get('collections')
  @Roles(Role.SUPER_ADMIN, Role.STORE_MANAGER)
  getCollections(
    @CurrentUser('storeId') storeId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    // Use IST offset so date strings map to IST midnight / end-of-day
    const fromDate = from ? new Date(from + 'T00:00:00+05:30') : new Date(new Date().toLocaleDateString('en-CA') + 'T00:00:00+05:30');
    const toDate   = to   ? new Date(to   + 'T23:59:59+05:30') : new Date(new Date().toLocaleDateString('en-CA') + 'T23:59:59+05:30');
    return this.billingService.getCollectionsSummary(storeId, fromDate, toDate);
  }
}
