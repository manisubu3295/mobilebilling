import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WebsiteService } from './website.service';
import { CreateLeadDto } from './dto/create-lead.dto';

// Unauthenticated on purpose — the marketing/ecommerce site (a separate
// domain/app) has no logged-in user. Tenant is resolved from `siteKey`
// (see WebsiteService.resolvePublicAccount), never a JWT.
@Controller('public/site/:siteKey')
export class WebsitePublicController {
  constructor(private websiteService: WebsiteService) {}

  @Get('products')
  listProducts(@Param('siteKey') siteKey: string) {
    return this.websiteService.listPublicProducts(siteKey);
  }

  @Get('products/:id')
  getProduct(@Param('siteKey') siteKey: string, @Param('id') id: string) {
    return this.websiteService.getPublicProduct(siteKey, id);
  }

  @Get('categories')
  listCategories(@Param('siteKey') siteKey: string) {
    return this.websiteService.listPublicCategories(siteKey);
  }

  @Post('leads')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  createLead(@Param('siteKey') siteKey: string, @Body() dto: CreateLeadDto) {
    return this.websiteService.createPublicLead(siteKey, dto);
  }
}
