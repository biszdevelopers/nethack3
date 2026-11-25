import nodemailer, { type Transporter } from "nodemailer";
import type { Logger } from "../../core/logger.js";

export interface EmailMessage {
    readonly to: string;
    readonly subject: string;
    readonly text: string;
}

export interface Mailer {
    send(message: EmailMessage): Promise<void>;
}

export class SmtpMailer implements Mailer {
    private readonly transport: Transporter;
    private readonly from: string;

    constructor(url: string, from: string) {
        this.transport = nodemailer.createTransport(url);
        this.from = from;
    }

    async send(message: EmailMessage): Promise<void> {
        await this.transport.sendMail({
            from: this.from,
            to: message.to,
            subject: message.subject,
            text: message.text,
        });
    }
}

export class LoggingMailer implements Mailer {
    private readonly logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger.child({ component: "mailer" });
    }

    async send(message: EmailMessage): Promise<void> {
        this.logger.info("Email delivery is not configured; message was not sent.", {
            toDomain: message.to.split("@")[1] ?? "unknown",
            subjectLength: message.subject.length,
        });
    }
}
