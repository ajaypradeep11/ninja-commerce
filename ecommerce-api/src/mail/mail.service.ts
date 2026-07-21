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

    await this.deliver({
      to: order.email,
      subject: copy.subject,
      text,
      logRef: `${order.status} email for order ${order.id}`,
    });
  }

  // Confirms receipt to the customer and alerts the support inbox so someone
  // actions the return once the item is back — requestReturn() itself only
  // flags the order, it does not refund.
  async sendReturnRequestedEmails(order: Order): Promise<void> {
    const shortId = order.id.slice(-8).toUpperCase();
    const total =
      order.totalCents != null
        ? `\nOrder total: $${(order.totalCents / 100).toFixed(2)}`
        : '';
    const reasonLine = order.returnReason ? `\nReason: ${order.returnReason}` : '';

    await this.deliver({
      to: order.email,
      subject: 'We received your return request',
      text:
        `Hi,\n\nWe've received your request to return order ${shortId}. ` +
        `Once it arrives back with us we'll refund your original payment ` +
        `method — no store credit, no restocking fee.${total}\n\n` +
        `Questions? Just reply to this email or write to ${SUPPORT_EMAIL}.\n\n` +
        `— The LocalNinja team`,
      logRef: `return-request confirmation for order ${order.id}`,
    });

    await this.deliver({
      to: SUPPORT_EMAIL,
      subject: `Return requested — order ${shortId}`,
      text:
        `Order ${order.id} (${order.email}) requested a return.` +
        `${total}${reasonLine}\n\n` +
        `Once the item is back, refund it from the admin order detail page.`,
      logRef: `return-request ops alert for order ${order.id}`,
    });
  }

  private async deliver(message: {
    to: string;
    subject: string;
    text: string;
    logRef: string;
  }): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `SMTP not configured — skipped "${message.subject}" to ${message.to} (${message.logRef})`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
      this.logger.log(`Sent ${message.logRef}`);
    } catch (err) {
      this.logger.error(
        `Failed to send ${message.logRef}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
