// Minimal types for the parts of Nodemailer 10 we use (the package ships no type definitions).
declare module "nodemailer" {
  export interface SmtpOptions {
    host: string;
    port: number;
    secure: boolean;
    requireTLS?: boolean;
    auth: { user: string; pass: string };
    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
    tls?: { minVersion?: string };
  }
  export interface MailOptions {
    from: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
    messageId?: string;
  }
  export interface SentInfo {
    messageId?: string;
    accepted?: unknown[];
    rejected?: unknown[];
    response?: string;
  }
  export interface Transporter {
    sendMail(options: MailOptions): Promise<SentInfo>;
    verify(): Promise<true>;
    close(): void;
  }
  export function createTransport(options: SmtpOptions): Transporter;
  const nodemailer: { createTransport: typeof createTransport };
  export default nodemailer;
}
