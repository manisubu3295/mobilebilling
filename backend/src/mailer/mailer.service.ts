import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { MasterPrismaService } from '../master-prisma/master-prisma.service';

interface SmtpConfig {
  host?: string | null;
  port: number;
  user?: string | null;
  pass?: string | null;
  from: string;
}

// Wraps SMTP delivery. Config is read from the PlatformSettings table (editable via
// the admin console), falling back to env vars for any field not set there yet.
// Until a host is configured either way, sends are logged instead of attempted so
// local/dev work isn't blocked on having real mail credentials.
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private master: MasterPrismaService) {}

  private async getSettings() {
    return this.master.platformSettings.findUnique({ where: { id: 'singleton' } });
  }

  private async getSmtpConfig(): Promise<SmtpConfig> {
    const settings = await this.getSettings();
    return {
      host: settings?.smtpHost || process.env.SMTP_HOST,
      port: settings?.smtpPort || Number(process.env.SMTP_PORT) || 587,
      user: settings?.smtpUser || process.env.SMTP_USER,
      pass: settings?.smtpPass || process.env.SMTP_PASS,
      from: settings?.smtpFrom || process.env.SMTP_FROM || 'no-reply@aadhirai.example',
    };
  }

  async getAdminNotifyEmail(): Promise<string | undefined> {
    const settings = await this.getSettings();
    return settings?.adminNotifyEmail || process.env.ADMIN_NOTIFY_EMAIL || undefined;
  }

  async send(to: string, subject: string, text: string) {
    const config = await this.getSmtpConfig();
    if (!config.host) {
      this.logger.warn(`SMTP not configured — email NOT sent. To: ${to} | Subject: ${subject}\n${text}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: config.user ? { user: config.user, pass: config.pass || undefined } : undefined,
    });

    try {
      await transporter.sendMail({ from: config.from, to, subject, text });
    } catch (err) {
      // A misconfigured/unreachable SMTP server shouldn't fail the request that
      // triggered the email (e.g. the reset request itself is already saved) — log
      // and move on rather than throwing.
      this.logger.error(`Failed to send email to ${to}: ${(err as Error).message}`);
    }
  }
}
