import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    const m = this.config.get<any>('mail');
    if (m?.host) {
      this.transporter = nodemailer.createTransport({
        host: m.host,
        port: m.port,
        secure: m.secure,
        auth: m.user ? { user: m.user, pass: m.pass } : undefined,
      });
    } else {
      this.logger.warn('SMTP не настроен — письма логируются, но не отправляются.');
    }
  }

  async send(to: string, subject: string, html: string, text?: string) {
    const from = this.config.get<any>('mail').from;
    if (!this.transporter) {
      this.logger.log(`[MAIL skipped] → ${to}: ${subject}`);
      return;
    }
    await this.transporter.sendMail({
      from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' '),
    });
  }

  async notifyApprovalNeeded(to: string, approverName: string, docNumber: string, link: string) {
    await this.send(
      to,
      `Требуется согласование: ${docNumber}`,
      `<p>Здравствуйте, ${approverName}.</p><p>На ваше согласование поступил документ <b>${docNumber}</b>.</p><p><a href="${link}">Открыть</a></p>`,
    );
  }
}
