
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export type MailServerConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  // Proton Bridge uses a self-signed certificate on localhost
  allowSelfSigned: boolean;
};

function server(prefix: "SMTP" | "IMAP"): MailServerConfig | null {
  const host = process.env[`${prefix}_HOST`];
  const port = Number(process.env[`${prefix}_PORT`]);
  const user = process.env[`${prefix}_USER`];
  const pass = process.env[`${prefix}_PASS`];
  if (!host || !port || !user || !pass) return null;
  return { host, port, user, pass, allowSelfSigned: LOCAL_HOSTS.has(host) };
}

export const smtpConfig = () => server("SMTP");
export const imapConfig = () => server("IMAP");

export function fromAddress(): { address: string; name: string } {
  const address = process.env.MAIL_FROM_ADDRESS ?? process.env.SMTP_USER;
  if (!address) throw new Error("MAIL_FROM_ADDRESS mancante in .env.local");
  return { address, name: process.env.MAIL_FROM_NAME ?? "" };
}

export function providerName(): string {
  return process.env.EMAIL_PROVIDER ?? "console";
}
