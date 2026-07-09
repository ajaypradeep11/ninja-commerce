import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        return this.runOnce(event, (tx) =>
          this.onSessionCompleted(tx, event.data.object),
        );
      case 'checkout.session.expired':
        return this.runOnce(event, (tx) =>
          this.onSessionExpired(tx, event.data.object),
        );
      case 'charge.refunded':
        return this.runOnce(event, (tx) =>
          this.onChargeRefunded(tx, event.data.object),
        );
      default:
        return; // not our concern
    }
  }

  /** Runs fn exactly once per Stripe event id — dedup row and side effects share one transaction. */
  private async runOnce(
    event: Stripe.Event,
    fn: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.processedStripeEvent.create({
          data: { id: event.id, type: event.type },
        });
        await fn(tx);
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        this.logger.log(`Skipping duplicate event ${event.id}`);
        return;
      }
      this.logger.error(
        `Failed processing event ${event.id} (${event.type}) — Stripe will retry`,
        e instanceof Error ? e.stack : String(e),
      );
      throw e;
    }
  }

  private async onSessionCompleted(
    tx: Prisma.TransactionClient,
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const orderId = session.metadata?.orderId;
    if (!orderId) {
      this.logger.warn(`Session ${session.id} has no orderId metadata`);
      return;
    }
    if (session.payment_status !== 'paid') {
      this.logger.warn(
        `Session ${session.id} for order ${orderId} has payment_status "${session.payment_status}" — not marking paid`,
      );
      return;
    }
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.status !== 'PENDING') return;

    for (const item of order.items) {
      const result = await tx.product.updateMany({
        where: { id: item.productId, stockQty: { gte: item.quantity } },
        data: { stockQty: { decrement: item.quantity } },
      });
      if (result.count === 0) {
        this.logger.error(
          `Stock shortfall: product ${item.productId} on order ${order.id} — paid but not decremented, manual action required`,
        );
      }
    }

    const shipping =
      session.collected_information?.shipping_details ??
      (session as unknown as { shipping_details?: unknown })
        .shipping_details ??
      session.customer_details ??
      null;

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        stripePaymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
        totalCents: session.amount_total ?? order.subtotalCents,
        shippingAddress:
          shipping === null ? Prisma.JsonNull : (shipping as object),
      },
    });
  }

  private async onSessionExpired(
    tx: Prisma.TransactionClient,
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const orderId = session.metadata?.orderId;
    if (!orderId) return;
    await tx.order.updateMany({
      where: { id: orderId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  }

  private async onChargeRefunded(
    tx: Prisma.TransactionClient,
    charge: Stripe.Charge,
  ): Promise<void> {
    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (!paymentIntentId) return;

    if (!charge.refunded) {
      this.logger.warn(
        `Partial refund on ${charge.id} — order left unchanged, manual review`,
      );
      return;
    }

    const order = await tx.order.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      include: { items: true },
    });
    if (!order || order.status === 'REFUNDED') return;

    for (const item of order.items) {
      await tx.product.updateMany({
        where: { id: item.productId },
        data: { stockQty: { increment: item.quantity } },
      });
    }
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'REFUNDED' },
    });
  }
}
