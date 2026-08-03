import nodemailer from "nodemailer";
import type { EmailTransport, TransactionalEmail } from "./types.js";
import type { EmailConfig } from "./config.js";

type SmtpConfig = Extract<EmailConfig, { transport: "smtp" }>;

export class SmtpEmailTransport implements EmailTransport {
  readonly #from: string;
  readonly #transport;

  constructor(config: SmtpConfig) {
    this.#from = config.from;
    this.#transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user && config.password ? { user: config.user, pass: config.password } : undefined
    });
  }

  async send(message: TransactionalEmail) {
    await this.#transport.sendMail({
      from: this.#from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html
    });
  }
}
