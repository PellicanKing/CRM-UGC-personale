import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { fromAddress, providerName, smtpConfig } from "./config";

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  // Message-ID of the first email, to thread follow-ups under it
  inReplyTo?: string;
}

export interface SendResult {
  // RFC 5322 Message-ID, stored to match replies
  messageId: string;
}

/** Abstraction over the sending backend. */
export interface EmailProvider {
  readonly name: string;
  send(email: OutgoingEmail): Promise<SendResult>;
  verify(): Promise<void>;
}

/** Dry-run provider: logs to the server console, sends nothing. */
class ConsoleProvider implements EmailProvider {
  readonly name = "console";
  async send(email: OutgoingEmail): Promise<SendResult> {
    console.log(`[email:dry-run] to=${email.to} subject=${email.subject}\n${email.text}`);
    return { messageId: `<dry-${Date.now()}@localhost>` };
  }
  async verify() {}
}

/**
 * Proton Mail via SMTP: either Proton Mail Bridge (127.0.0.1:1025, STARTTLS,
 * self-signed cert) or Proton SMTP submission (smtp.protonmail.ch:587 + token).
 */
class ProtonSmtpProvider implements EmailProvider {
  readonly name = "proton";
  private transport: Transporter;

  constructor() {
    const cfg = smtpConfig();
    if (!cfg) throw new Error("Configurazione SMTP incompleta (SMTP_HOST/PORT/USER/PASS in .env.local)");
    this.transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      requireTLS: cfg.port !== 465,
      auth: { user: cfg.user, pass: cfg.pass },
      tls: cfg.allowSelfSigned ? { rejectUnauthorized: false } : undefined,
    });
  }

  async send(email: OutgoingEmail): Promise<SendResult> {
    const info = await this.transport.sendMail({
      from: fromAddress(),
      to: email.to,
      subject: email.subject,
      text: email.text,
      inReplyTo: email.inReplyTo,
      references: email.inReplyTo,
    });
    return { messageId: info.messageId };
  }

  async verify() {
    await this.transport.verify();
  }
}

let cached: EmailProvider | null = null;
export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  switch (providerName()) {
    case "console":
      cached = new ConsoleProvider();
      break;
    case "proton":
      cached = new ProtonSmtpProvider();
      break;
    default:
      throw new Error(`Provider email non supportato: ${providerName()}`);
  }
  return cached;
}

/** Builds the final email body: text + signature + opt-out line (always present). */
export function composeBody(text: string, signature: string, unsubscribeText: string): string {
  return [text.trim(), signature.trim(), `—\n${unsubscribeText.trim()}`]
    .filter(Boolean)
    .join("\n\n");
}
