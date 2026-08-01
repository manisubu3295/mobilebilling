import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { MasterPrismaService } from '../../master-prisma/master-prisma.service';

@Injectable()
export class PlatformAdminJwtStrategy extends PassportStrategy(Strategy, 'platform-admin-jwt') {
  constructor(private master: MasterPrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.PLATFORM_ADMIN_JWT_SECRET || 'platform-admin-secret',
    });
  }

  async validate(payload: { sub: string }) {
    const admin = await this.master.platformAdmin.findUnique({ where: { id: payload.sub } });
    if (!admin) throw new UnauthorizedException();
    return { id: admin.id, email: admin.email, name: admin.name };
  }
}
