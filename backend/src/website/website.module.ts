import { Module } from '@nestjs/common';
import { WebsitePublicController } from './website-public.controller';
import { WebsiteAdminController } from './website-admin.controller';
import { WebsiteService } from './website.service';

@Module({
  controllers: [WebsitePublicController, WebsiteAdminController],
  providers: [WebsiteService],
})
export class WebsiteModule {}
