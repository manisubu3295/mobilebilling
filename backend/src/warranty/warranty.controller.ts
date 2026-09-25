import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { WarrantyService } from './warranty.service';
import { ApproveWarrantyDto } from './dto/approve-warranty.dto';
import { UpdateWarrantyDto } from './dto/update-warranty.dto';
import { AssignServiceJobDto } from './dto/assign-service-job.dto';
import { UpdateServiceJobDto } from './dto/update-service-job.dto';
import { CreateServiceJobDto } from './dto/create-service-job.dto';
import { RescheduleServiceJobDto } from './dto/reschedule-service-job.dto';
import { BillServiceJobDto } from './dto/bill-service-job.dto';
import { AddServiceJobPartDto } from './dto/add-service-job-part.dto';
import { CreateStandaloneWarrantyDto } from './dto/create-standalone-warranty.dto';
import { UpdateWarrantyCardDto } from './dto/warranty-card.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ServiceModuleGuard } from '../common/guards/service-module.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, ServiceJobStatus, WarrantyStatus } from '@prisma/client';

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.STORE_MANAGER];

class SetRemindedDto {
  @IsBoolean() reminded: boolean;
}

@Controller('warranty')
@UseGuards(JwtAuthGuard, ServiceModuleGuard, RolesGuard)
export class WarrantyController {
  constructor(private warrantyService: WarrantyService) {}

  @Get()
  @Roles(...ADMIN_ROLES)
  listWarranties(@CurrentUser('storeId') storeId: string, @Query('status') status?: WarrantyStatus) {
    return this.warrantyService.listWarranties(storeId, status);
  }

  @Post()
  @Roles(...ADMIN_ROLES)
  createStandaloneWarranty(
    @Body() dto: CreateStandaloneWarrantyDto,
    @CurrentUser('storeId') storeId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.warrantyService.createStandaloneWarranty(storeId, userId, dto);
  }

  @Post('import')
  @Roles(...ADMIN_ROLES)
  importWarranties(
    @Body() body: { rows: any[] },
    @CurrentUser('storeId') storeId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.warrantyService.importWarranties(body.rows, userId, storeId);
  }

  @Patch(':id/approve')
  @Roles(...ADMIN_ROLES)
  approveWarranty(
    @Param('id') id: string,
    @Body() dto: ApproveWarrantyDto,
    @CurrentUser('storeId') storeId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.warrantyService.approveWarranty(id, storeId, dto, userId);
  }

  @Patch(':id/cancel')
  @Roles(...ADMIN_ROLES)
  cancelWarranty(@Param('id') id: string, @CurrentUser('storeId') storeId: string) {
    return this.warrantyService.cancelWarranty(id, storeId);
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  updateWarranty(
    @Param('id') id: string,
    @Body() dto: UpdateWarrantyDto,
    @CurrentUser('storeId') storeId: string,
  ) {
    return this.warrantyService.updateWarranty(id, storeId, dto);
  }

  @Get(':id/card')
  @Roles(...ADMIN_ROLES)
  getWarrantyCard(@Param('id') id: string, @CurrentUser('storeId') storeId: string) {
    return this.warrantyService.getWarrantyCard(id, storeId);
  }

  @Patch(':id/card')
  @Roles(...ADMIN_ROLES)
  updateWarrantyCard(
    @Param('id') id: string,
    @Body() dto: UpdateWarrantyCardDto,
    @CurrentUser('storeId') storeId: string,
  ) {
    return this.warrantyService.updateWarrantyCard(id, storeId, dto);
  }

  @Patch(':id/reactivate')
  @Roles(...ADMIN_ROLES)
  reactivateWarranty(@Param('id') id: string, @CurrentUser('storeId') storeId: string) {
    return this.warrantyService.reactivateWarranty(id, storeId);
  }

  @Get('service-jobs')
  @Roles(...ADMIN_ROLES)
  listServiceJobs(
    @CurrentUser('storeId') storeId: string,
    @Query('status') status?: ServiceJobStatus,
    @Query('assignedToId') assignedToId?: string,
  ) {
    return this.warrantyService.listServiceJobs(storeId, { status, assignedToId });
  }

  @Get('service-jobs/my')
  @Roles(Role.SERVICE_STAFF, ...ADMIN_ROLES)
  myServiceJobs(@CurrentUser('storeId') storeId: string, @CurrentUser('id') userId: string) {
    return this.warrantyService.myServiceJobs(storeId, userId);
  }

  @Post('service-jobs')
  @Roles(...ADMIN_ROLES)
  createServiceJob(@Body() dto: CreateServiceJobDto, @CurrentUser('storeId') storeId: string) {
    return this.warrantyService.createServiceJob(storeId, dto);
  }

  @Patch('service-jobs/:id/reschedule')
  @Roles(...ADMIN_ROLES)
  rescheduleServiceJob(
    @Param('id') id: string,
    @Body() dto: RescheduleServiceJobDto,
    @CurrentUser('storeId') storeId: string,
  ) {
    return this.warrantyService.rescheduleServiceJob(id, storeId, dto.dueDate);
  }

  @Patch('service-jobs/:id/cancel')
  @Roles(...ADMIN_ROLES)
  cancelServiceJob(@Param('id') id: string, @CurrentUser('storeId') storeId: string) {
    return this.warrantyService.cancelServiceJob(id, storeId);
  }

  @Patch('service-jobs/:id/assign')
  @Roles(...ADMIN_ROLES)
  assignServiceJob(
    @Param('id') id: string,
    @Body() dto: AssignServiceJobDto,
    @CurrentUser('storeId') storeId: string,
  ) {
    return this.warrantyService.assignServiceJob(id, storeId, dto.assignedToId);
  }

  @Patch('service-jobs/:id/update')
  @Roles(Role.SERVICE_STAFF, ...ADMIN_ROLES)
  updateServiceJob(
    @Param('id') id: string,
    @Body() dto: UpdateServiceJobDto,
    @CurrentUser('storeId') storeId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.warrantyService.updateServiceJob(id, storeId, userId, role, dto);
  }

  @Patch('service-jobs/:id/bill')
  @Roles(Role.SERVICE_STAFF, ...ADMIN_ROLES)
  billServiceJob(
    @Param('id') id: string,
    @Body() dto: BillServiceJobDto,
    @CurrentUser() user: any,
  ) {
    return this.warrantyService.billServiceJob(id, user.storeId, user.id, dto, user.role);
  }

  @Patch('service-jobs/:id/reminded')
  @Roles(Role.SERVICE_STAFF, ...ADMIN_ROLES)
  setReminded(@Param('id') id: string, @Body() body: SetRemindedDto, @CurrentUser() user: any) {
    return this.warrantyService.setReminded(id, user.storeId, user.id, user.role, body.reminded);
  }

  // One job with everything the Service Bill page needs (customer, parts,
  // charge) — used when a technician bills a visit from My Service Jobs.
  @Get('service-jobs/:id')
  @Roles(Role.SERVICE_STAFF, ...ADMIN_ROLES)
  getServiceJob(@Param('id') id: string, @CurrentUser() user: any) {
    return this.warrantyService.getServiceJob(id, user.storeId, user.id, user.role);
  }

  @Post('service-jobs/:id/parts')
  @Roles(Role.SERVICE_STAFF, ...ADMIN_ROLES)
  addServiceJobPart(
    @Param('id') id: string,
    @Body() dto: AddServiceJobPartDto,
    @CurrentUser('storeId') storeId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.warrantyService.addServiceJobPart(id, storeId, userId, dto);
  }

  @Delete('service-jobs/:id/parts/:partId')
  @Roles(Role.SERVICE_STAFF, ...ADMIN_ROLES)
  removeServiceJobPart(
    @Param('id') id: string,
    @Param('partId') partId: string,
    @CurrentUser('storeId') storeId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.warrantyService.removeServiceJobPart(id, partId, storeId, userId);
  }

  @Patch('service-jobs/:id/close')
  @Roles(Role.SERVICE_STAFF, ...ADMIN_ROLES)
  closeServiceJob(
    @Param('id') id: string,
    @Body() dto: UpdateServiceJobDto,
    @CurrentUser('storeId') storeId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.warrantyService.closeServiceJob(id, storeId, userId, role, dto);
  }

  @Get('reports/service-expenses')
  @Roles(...ADMIN_ROLES)
  serviceExpenseReport(
    @CurrentUser('storeId') storeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from + 'T00:00:00+05:30') : new Date(new Date().toLocaleDateString('en-CA') + 'T00:00:00+05:30');
    const toDate = to ? new Date(to + 'T23:59:59+05:30') : new Date(new Date().toLocaleDateString('en-CA') + 'T23:59:59+05:30');
    return this.warrantyService.serviceExpenseReport(storeId, fromDate, toDate);
  }

  @Get('nearing-due')
  @Roles(Role.SERVICE_STAFF, ...ADMIN_ROLES)
  nearingDue(
    @CurrentUser('storeId') storeId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
    @Query('days') days?: string,
  ) {
    return this.warrantyService.nearingDue(storeId, role, userId, days !== undefined ? +days : undefined);
  }
}
