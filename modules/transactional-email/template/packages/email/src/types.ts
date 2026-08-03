export type EmailTemplate = "verify-email" | "reset-password";

export type TransactionalEmail = Readonly<{
  to: string;
  template: EmailTemplate;
  subject: string;
  text: string;
  html: string;
}>;

export interface EmailTransport {
  send(message: TransactionalEmail): Promise<void>;
}
