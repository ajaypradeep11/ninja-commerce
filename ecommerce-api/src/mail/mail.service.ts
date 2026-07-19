import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { Order, OrderStatus } from '@prisma/client';

const DEFAULT_FROM = 'LocalNinja Support <support@localninja.ca>';
const SUPPORT_EMAIL = 'support@localninja.ca';

const STATUS_COPY: Partial<
  Record<OrderStatus, { subject: string; intro: string }>
> = {
  SHIPPED: {
    subject: 'Your LocalNinja order has shipped!',
    intro: 'Good news — your order is on its way.',
  },
  DELIVERED: {
    subject: 'Your LocalNinja order has been delivered',
    intro: 'Your order has been delivered. We hope you love it!',
  },
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.get<string>('MAIL_FROM') || DEFAULT_FROM;
    const host = config.get<string>('SMTP_HOST');
    if (host) {
      const port = Number(config.get<string>('SMTP_PORT')) || 587;
      const user = config.get<string>('SMTP_USER');
      const pass = config.get<string>('SMTP_PASS');
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user ? { user, pass } : undefined,
      });
    } else {
      // No SMTP configured (local dev / placeholder mode): emails are logged,
      // never sent, and the rest of the app behaves normally.
      this.transporter = null;
    }
  }

  // Never throws — a mail failure must not fail the action that triggered it.
  async sendOrderStatusEmail(order: Order): Promise<void> {
    const copy = STATUS_COPY[order.status];
    if (!copy) return;

    const shortId = order.id.slice(-8).toUpperCase();
    const total =
      order.totalCents != null
        ? `\nOrder total: $${(order.totalCents / 100).toFixed(2)}`
        : '';
    const text =
      `Hi,\n\n${copy.intro}\n\n` +
      `Order reference: ${shortId}${total}\n\n` +
      `Questions? Just reply to this email or write to ${SUPPORT_EMAIL}.\n\n` +
      `— The LocalNinja team`;

    if (!this.transporter) {
      this.logger.log(
        `SMTP not configured — skipped "${copy.subject}" to ${order.email} (order ${order.id})`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: order.email,
        subject: copy.subject,
        text,
      });
      this.logger.log(`Sent ${order.status} email for order ${order.id}`);
    } catch (err) {
      this.logger.error(
        `Failed to send ${order.status} email for order ${order.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
