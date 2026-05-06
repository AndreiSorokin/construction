import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, Transporter } from "nodemailer";

type InviteEmail = {
  to: string;
  name: string;
  objectName: string;
  invitedBy: string;
  inviteLink: string;
};

type AccessGrantedEmail = {
  to: string;
  name: string;
  objectName: string;
  invitedBy: string;
};

type MailResult = {
  sent: boolean;
  error?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter?: Transporter;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>("SMTP_HOST");
    const port = this.config.get<number>("SMTP_PORT");
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASS");

    if (host && port && user && pass) {
      this.transporter = createTransport({
        host,
        port,
        secure: this.config.get<string>("SMTP_SECURE") === "true",
        auth: { user, pass },
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 30_000,
        tls: {
          rejectUnauthorized:
            this.config.get<string>("SMTP_TLS_REJECT_UNAUTHORIZED") !== "false",
        },
      });
    }
  }

  async sendInvitationEmail(email: InviteEmail): Promise<MailResult> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP is not configured. Invitation link for ${email.to}: ${email.inviteLink}`,
      );
      return { sent: false, error: "SMTP is not configured" };
    }

    return this.sendSafely(
      email.to,
      `Invitation to ${email.objectName}`,
      [
        `Здравствуйте, ${email.name}.`,
        `${email.invitedBy} пригласил вас в систему управления строительного контроля для "${email.objectName}".`,
        `Завершите регистрацию, используя эту ссылку: ${email.inviteLink}`,
      ].join("\n\n"),
      "invitation",
    );
  }

  async sendAccessGrantedEmail(email: AccessGrantedEmail): Promise<MailResult> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP is not configured. Access granted notification for ${email.to}`,
      );
      return { sent: false, error: "SMTP is not configured" };
    }

    return this.sendSafely(
      email.to,
      `Access granted to ${email.objectName}`,
      [
        `Здравствуйте, ${email.name}.`,
        `${email.invitedBy} выдал вам доступ к "${email.objectName}" в системе управления строительного контроля.`,
        "Вы можете войти в систему с использованием существующей учетной записи.",
      ].join("\n\n"),
      "access granted",
    );
  }

  private async sendSafely(
    to: string,
    subject: string,
    text: string,
    purpose: string,
  ): Promise<MailResult> {
    try {
      await this.transporter?.sendMail({
        from:
          this.config.get<string>("SMTP_FROM") ??
          this.config.get<string>("SMTP_USER"),
        to,
        subject,
        text,
      });

      return { sent: true };
    } catch (error) {
      this.logger.error(
        `Failed to send ${purpose} email to ${to}`,
        error instanceof Error ? error.stack : String(error),
      );

      return {
        sent: false,
        error: error instanceof Error ? error.message : "Unknown SMTP error",
      };
    }
  }
}
