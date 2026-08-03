import { log } from "@{{PROJECT_NAME}}/observability";
import type { EmailTransport, TransactionalEmail } from "./types.js";

export class ConsoleEmailTransport implements EmailTransport {
  async send(message: TransactionalEmail) {
    log("info", "transactional_email_captured", { template: message.template });
  }
}
