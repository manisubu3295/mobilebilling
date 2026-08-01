import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

// Wraps SMTP delivery. Until SMTP_HOST is configured, sends are logged instead of
// attempted so local/dev work isn't blocked on having real mail credentials.
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter | null {
    if (!process.env.SMTP_HOST) return null;
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
    }
    return this.transporter;
  }

  async send(to: string, subject: string, text: string) {
    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.warn(`SMTP not configured — email NOT sent. To: ${to} | Subject: ${subject}\n${text}`);
      return;
    }

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'no-reply@aadhirai.example',
      to,
      subject,
      text,
    });
  }
}
