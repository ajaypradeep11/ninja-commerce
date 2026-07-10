/**
 * Seeds demo catalog + orders into the local dev database so the admin UI
 * has data to show. Idempotent via upserts on slugs/ids.
 *
 * Usage: npm run seed:demo
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const tees = await prisma.category.upsert({
    where: { slug: 'tees' },
    update: {},
    create: { name: 'Tees', slug: 'tees', sortOrder: 0 },
  });
  const hoodies = await prisma.category.upsert({
    where: { slug: 'hoodies' },
    update: {},
    create: { name: 'Hoodies', slug: 'hoodies', sortOrder: 1 },
  });

  const tee = await prisma.product.upsert({
    where: { slug: 'organic-cotton-tee' },
    update: {},
    create: {
      name: 'Organic Cotton Tee',
      slug: 'organic-cotton-tee',
      description: 'Soft, breathable, 100% organic cotton.',
      priceCents: 2900,
      images: [],
      stockQty: 40,
      categoryId: tees.id,
    },
  });
  await prisma.product.upsert({
    where: { slug: 'heavyweight-hoodie' },
    update: {},
    create: {
      name: 'Heavyweight Hoodie',
      slug: 'heavyweight-hoodie',
      description: 'Brushed fleece interior, relaxed fit.',
      priceCents: 7900,
      images: [],
      stockQty: 3, // low stock on purpose (threshold is 5)
      categoryId: hoodies.id,
    },
  });
  await prisma.product.upsert({
    where: { slug: 'retired-crewneck' },
    update: {},
    create: {
      name: 'Retired Crewneck',
      slug: 'retired-crewneck',
      description: 'Discontinued colourway.',
      priceCents: 5900,
      images: [],
      stockQty: 0,
      active: false,
      categoryId: hoodies.id,
    },
  });

  await prisma.user.upsert({
    where: { id: 'demo-buyer-uid' },
    update: {},
    create: { id: 'demo-buyer-uid', email: 'buyer@example.com' },
  });

  await prisma.order.upsert({
    where: { stripeSessionId: 'demo_session_paid' },
    update: {},
    create: {
      userId: 'demo-buyer-uid',
      email: 'buyer@example.com',
      status: 'PAID',
      stripeSessionId: 'demo_session_paid',
      stripePaymentIntentId: 'demo_pi_paid',
      shippingAddress: {
        name: 'Demo Buyer',
        line1: '1 Main St',
        city: 'Springfield',
        postal_code: '01101',
        country: 'US',
      },
      subtotalCents: 5800,
      totalCents: 5800,
      items: {
        create: [
          { productId: tee.id, name: tee.name, priceCents: 2900, quantity: 2 },
        ],
      },
    },
  });
  await prisma.order.upsert({
    where: { stripeSessionId: 'demo_session_shipped' },
    update: {},
    create: {
      userId: 'demo-buyer-uid',
      email: 'buyer@example.com',
      status: 'SHIPPED',
      stripeSessionId: 'demo_session_shipped',
      stripePaymentIntentId: 'demo_pi_shipped',
      shippingAddress: {
        name: 'Demo Buyer',
        line1: '1 Main St',
        city: 'Springfield',
        postal_code: '01101',
        country: 'US',
      },
      subtotalCents: 2900,
      totalCents: 2900,
      items: {
        create: [
          { productId: tee.id, name: tee.name, priceCents: 2900, quantity: 1 },
        ],
      },
    },
  });

  console.log('Demo data seeded.');
}

void main().finally(() => prisma.$disconnect());
