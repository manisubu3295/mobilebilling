import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminJwtStrategy } from './strategies/platform-admin-jwt.strategy';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    PassportModule,
    MailerModule,
    JwtModule.register({
      secret: process.env.PLATFORM_ADMIN_JWT_SECRET,
      signOptions: { expiresIn: '4h' },
    }),
  ],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService, PlatformAdminJwtStrategy],
})
export class PlatformAdminModule {}
