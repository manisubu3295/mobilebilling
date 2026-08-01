import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { TenantConnectionManager } from '../../prisma/tenant-connection.manager';
import { TenantContext } from '../../prisma/tenant-context';

interface AccessTokenPayload {
  sub: string;
  role: string;
  storeId: string;
  accountId: string;
}

// Decodes the bearer token independently of Passport (which only runs inside guards,
// too late for us) so the correct tenant PrismaClient can be placed into
// AsyncLocalStorage BEFORE any guard/handler touches PrismaService. Invalid/missing
// tokens simply fall through with no tenant context set — protected routes still 401
// as normal via JwtAuthGuard; public routes never needed tenant context to begin with.
@Injectable()
export class TenantResolutionMiddleware implements NestMiddleware {
  constructor(private tenantConnections: TenantConnectionManager) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token || !process.env.JWT_ACCESS_SECRET) {
      return next();
    }

    let payload: AccessTokenPayload;
    try {
      payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    } catch {
      // Invalid/expired token: let JwtAuthGuard reject it downstream with a proper 401.
      return next();
    }

    if (!payload.accountId) return next();

    try {
      const client = await this.tenantConnections.getClientForAccount(payload.accountId);
      TenantContext.run(client, () => next());
    } catch {
      // Token is well-formed but the account is gone/suspended — reject here rather
      // than letting a downstream handler crash on a missing tenant context.
      res.status(401).json({ statusCode: 401, message: 'Account not found or inactive' });
    }
  }
}
