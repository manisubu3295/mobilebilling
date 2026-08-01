import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PlatformAdminJwtGuard extends AuthGuard('platform-admin-jwt') {}
