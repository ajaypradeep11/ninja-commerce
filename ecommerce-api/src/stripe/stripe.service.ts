import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  readonly client: Stripe;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    this.client = new Stripe(config.getOrThrow<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2026-06-24.dahlia',
    });
    this.webhookSecret = config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.client.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret,
    );
  }
}
