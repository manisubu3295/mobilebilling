import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { Client } from 'pg';

const execFileAsync = promisify(execFile);

export interface ProvisionedTenant {
  dbName: string;
  dbUrl: string;
}

// Creates a brand-new, fully isolated PostgreSQL database for a signing-up account and
// applies the tenant schema's migrations to it. Runs once per signup.
@Injectable()
export class TenantProvisioningService {
  private readonly logger = new Logger(TenantProvisioningService.name);

  async provisionTenantDatabase(accountId: string): Promise<ProvisionedTenant> {
    const dbName = `tenant_${accountId}`.toLowerCase();
    if (!/^tenant_[a-f0-9]+$/.test(dbName)) {
      throw new Error(`Refusing to create database with unexpected name: ${dbName}`);
    }

    const adminUrl = process.env.PG_ADMIN_URL;
    if (!adminUrl) throw new Error('PG_ADMIN_URL is not set');

    await this.createDatabase(adminUrl, dbName);
    const dbUrl = this.buildTenantUrl(adminUrl, dbName);
    await this.runMigrations(dbUrl);

    return { dbName, dbUrl };
  }

  private async createDatabase(adminUrl: string, dbName: string) {
    const adminClient = new Client({ connectionString: adminUrl });
    await adminClient.connect();
    try {
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
    } finally {
      await adminClient.end();
    }
  }

  private buildTenantUrl(adminUrl: string, dbName: string): string {
    const url = new URL(adminUrl);
    url.pathname = `/${dbName}`;
    return url.toString();
  }

  private async runMigrations(dbUrl: string) {
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
    this.logger.log(`Provisioning tenant database, applying migrations from ${schemaPath}`);
    await execFileAsync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['prisma', 'migrate', 'deploy', `--schema=${schemaPath}`],
      {
        env: { ...process.env, DATABASE_URL: dbUrl },
        cwd: process.cwd(),
        shell: process.platform === 'win32',
      },
    );
  }
}
