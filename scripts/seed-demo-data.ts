/**
 * Seeds demo catalog + orders into the local dev database so the admin UI
 * (and the upcoming storefront) has data to show. Idempotent via upserts on
 * slugs/ids.
 *
 * Usage: npm run seed:demo
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const imgs = (slug: string) =>
  [1, 2, 3].map((n) => `https://picsum.photos/seed/${slug}-${n}/900/1125`);

async function main(): Promise<void> {
  const tees = await prisma.category.upsert({
    where: { slug: 'tees' },
    update: { sortOrder: 1 },
    create: { name: 'Tees', slug: 'tees', sortOrder: 1 },
  });
  const hoodies = await prisma.category.upsert({
    where: { slug: 'hoodies' },
    update: { sortOrder: 2 },
    create: { name: 'Hoodies', slug: 'hoodies', sortOrder: 2 },
  });
  const sweatpants = await prisma.category.upsert({
    where: { slug: 'sweatpants' },
    update: {},
    create: { name: 'Sweatpants', slug: 'sweatpants', sortOrder: 3 },
  });
  const accessories = await prisma.category.upsert({
    where: { slug: 'accessories' },
    update: {},
    create: { name: 'Accessories', slug: 'accessories', sortOrder: 4 },
  });

  const tee = await prisma.product.upsert({
    where: { slug: 'organic-cotton-tee' },
    update: {
      name: 'Organic Cotton Tee',
      description:
        'A mid-weight everyday tee in 100% GOTS-certified organic cotton. Pre-washed so it keeps its shape, wash after wash.',
      priceCents: 2900,
      images: imgs('organic-cotton-tee'),
      stockQty: 40,
      categoryId: tees.id,
    },
    create: {
      name: 'Organic Cotton Tee',
      slug: 'organic-cotton-tee',
      description:
        'A mid-weight everyday tee in 100% GOTS-certified organic cotton. Pre-washed so it keeps its shape, wash after wash.',
      priceCents: 2900,
      images: imgs('organic-cotton-tee'),
      stockQty: 40,
      categoryId: tees.id,
    },
  });
  const hoodie = await prisma.product.upsert({
    where: { slug: 'heavyweight-hoodie' },
    update: {
      name: 'Heavyweight Hoodie',
      description:
        'A brushed-fleece hoodie in a heavier 400gsm organic cotton blend. Relaxed fit, dropped shoulder, and a kangaroo pocket built for cold mornings.',
      priceCents: 7900,
      images: imgs('heavyweight-hoodie'),
      stockQty: 3, // low stock on purpose (threshold is 5)
      categoryId: hoodies.id,
    },
    create: {
      name: 'Heavyweight Hoodie',
      slug: 'heavyweight-hoodie',
      description:
        'A brushed-fleece hoodie in a heavier 400gsm organic cotton blend. Relaxed fit, dropped shoulder, and a kangaroo pocket built for cold mornings.',
      priceCents: 7900,
      images: imgs('heavyweight-hoodie'),
      stockQty: 3, // low stock on purpose (threshold is 5)
      categoryId: hoodies.id,
    },
  });
  await prisma.product.upsert({
    where: { slug: 'retired-crewneck' },
    update: {
      name: 'Retired Crewneck',
      description:
        'A discontinued colourway of our standard crewneck. Same 350gsm organic fleece, no longer in production.',
      priceCents: 5900,
      images: imgs('retired-crewneck'),
      stockQty: 0,
      categoryId: hoodies.id,
    },
    create: {
      name: 'Retired Crewneck',
      slug: 'retired-crewneck',
      description:
        'A discontinued colourway of our standard crewneck. Same 350gsm organic fleece, no longer in production.',
      priceCents: 5900,
      images: imgs('retired-crewneck'),
      stockQty: 0,
      active: false,
      categoryId: hoodies.id,
    },
  });

  await prisma.product.upsert({
    where: { slug: 'boxy-tee-ecru' },
    update: {
      name: 'Boxy Tee — Ecru',
      description:
        'A boxier, cropped cut of our house tee in undyed ecru organic cotton. Dropped shoulders and a wider body for an off-duty fit.',
      priceCents: 3200,
      images: imgs('boxy-tee-ecru'),
      stockQty: 25,
      categoryId: tees.id,
    },
    create: {
      name: 'Boxy Tee — Ecru',
      slug: 'boxy-tee-ecru',
      description:
        'A boxier, cropped cut of our house tee in undyed ecru organic cotton. Dropped shoulders and a wider body for an off-duty fit.',
      priceCents: 3200,
      images: imgs('boxy-tee-ecru'),
      stockQty: 25,
      categoryId: tees.id,
    },
  });
  await prisma.product.upsert({
    where: { slug: 'longsleeve-indigo' },
    update: {
      name: 'Longsleeve — Indigo',
      description:
        'A long-sleeve tee in a garment-dyed indigo that fades gently with every wash. Ribbed crew neck, same organic cotton jersey as the rest of the line.',
      priceCents: 3900,
      images: imgs('longsleeve-indigo'),
      stockQty: 18,
      categoryId: tees.id,
    },
    create: {
      name: 'Longsleeve — Indigo',
      slug: 'longsleeve-indigo',
      description:
        'A long-sleeve tee in a garment-dyed indigo that fades gently with every wash. Ribbed crew neck, same organic cotton jersey as the rest of the line.',
      priceCents: 3900,
      images: imgs('longsleeve-indigo'),
      stockQty: 18,
      categoryId: tees.id,
    },
  });
  await prisma.product.upsert({
    where: { slug: 'pocket-tee-madder' },
    update: {
      name: 'Pocket Tee — Madder',
      description:
        'A chest-pocket tee dyed with madder root for a warm, earthy red that varies slightly piece to piece. Currently sold out — restocking soon.',
      priceCents: 3400,
      images: imgs('pocket-tee-madder'),
      stockQty: 0,
      categoryId: tees.id,
    },
    create: {
      name: 'Pocket Tee — Madder',
      slug: 'pocket-tee-madder',
      description:
        'A chest-pocket tee dyed with madder root for a warm, earthy red that varies slightly piece to piece. Currently sold out — restocking soon.',
      priceCents: 3400,
      images: imgs('pocket-tee-madder'),
      stockQty: 0,
      categoryId: tees.id,
    },
  });
  await prisma.product.upsert({
    where: { slug: 'zip-hoodie-flax' },
    update: {
      name: 'Zip Hoodie — Flax',
      description:
        'A full-zip hoodie in a light flax colourway, cut from the same 400gsm organic fleece as the pullover. Ribbed cuffs and hem keep the shape over time.',
      priceCents: 8900,
      images: imgs('zip-hoodie-flax'),
      stockQty: 12,
      categoryId: hoodies.id,
    },
    create: {
      name: 'Zip Hoodie — Flax',
      slug: 'zip-hoodie-flax',
      description:
        'A full-zip hoodie in a light flax colourway, cut from the same 400gsm organic fleece as the pullover. Ribbed cuffs and hem keep the shape over time.',
      priceCents: 8900,
      images: imgs('zip-hoodie-flax'),
      stockQty: 12,
      categoryId: hoodies.id,
    },
  });
  await prisma.product.upsert({
    where: { slug: 'french-terry-sweatpant' },
    update: {
      name: 'French Terry Sweatpant',
      description:
        'A tapered sweatpant in brushed French terry, with an elastic waistband and drawcord. Cut from the same organic cotton as the rest of the range.',
      priceCents: 6900,
      images: imgs('french-terry-sweatpant'),
      stockQty: 20,
      categoryId: sweatpants.id,
    },
    create: {
      name: 'French Terry Sweatpant',
      slug: 'french-terry-sweatpant',
      description:
        'A tapered sweatpant in brushed French terry, with an elastic waistband and drawcord. Cut from the same organic cotton as the rest of the range.',
      priceCents: 6900,
      images: imgs('french-terry-sweatpant'),
      stockQty: 20,
      categoryId: sweatpants.id,
    },
  });
  await prisma.product.upsert({
    where: { slug: 'lounge-short' },
    update: {
      name: 'Lounge Short',
      description:
        'A relaxed lounge short in mid-weight French terry, with side pockets and a covered elastic waistband. Only a few left in this run.',
      priceCents: 4400,
      images: imgs('lounge-short'),
      stockQty: 5,
      categoryId: sweatpants.id,
    },
    create: {
      name: 'Lounge Short',
      slug: 'lounge-short',
      description:
        'A relaxed lounge short in mid-weight French terry, with side pockets and a covered elastic waistband. Only a few left in this run.',
      priceCents: 4400,
      images: imgs('lounge-short'),
      stockQty: 5,
      categoryId: sweatpants.id,
    },
  });
  await prisma.product.upsert({
    where: { slug: 'beanie-rib-knit' },
    update: {
      name: 'Rib Knit Beanie',
      description:
        'A snug, ribbed beanie knit from organic cotton yarn. One size, unlined, with a folded cuff.',
      priceCents: 2400,
      images: imgs('beanie-rib-knit'),
      stockQty: 30,
      categoryId: accessories.id,
    },
    create: {
      name: 'Rib Knit Beanie',
      slug: 'beanie-rib-knit',
      description:
        'A snug, ribbed beanie knit from organic cotton yarn. One size, unlined, with a folded cuff.',
      priceCents: 2400,
      images: imgs('beanie-rib-knit'),
      stockQty: 30,
      categoryId: accessories.id,
    },
  });
  await prisma.product.upsert({
    where: { slug: 'tote-everyday' },
    update: {
      name: 'Everyday Tote',
      description:
        'A heavy-canvas tote built for daily use, with reinforced straps and a flat base that stands on its own. Undyed organic cotton canvas.',
      priceCents: 1800,
      images: imgs('tote-everyday'),
      stockQty: 50,
      categoryId: accessories.id,
    },
    create: {
      name: 'Everyday Tote',
      slug: 'tote-everyday',
      description:
        'A heavy-canvas tote built for daily use, with reinforced straps and a flat base that stands on its own. Undyed organic cotton canvas.',
      priceCents: 1800,
      images: imgs('tote-everyday'),
      stockQty: 50,
      categoryId: accessories.id,
    },
  });
  await prisma.product.upsert({
    where: { slug: 'canvas-cap' },
    update: {
      name: 'Canvas Cap',
      description:
        'A low-profile six-panel cap in the same heavy canvas as the tote, with a brass buckle strap for adjustable sizing.',
      priceCents: 2800,
      images: imgs('canvas-cap'),
      stockQty: 14,
      categoryId: accessories.id,
    },
    create: {
      name: 'Canvas Cap',
      slug: 'canvas-cap',
      description:
        'A low-profile six-panel cap in the same heavy canvas as the tote, with a brass buckle strap for adjustable sizing.',
      priceCents: 2800,
      images: imgs('canvas-cap'),
      stockQty: 14,
      categoryId: accessories.id,
    },
  });

  await prisma.user.upsert({
    where: { id: 'demo-buyer-uid' },
    update: {},
    create: { id: 'demo-buyer-uid', email: 'buyer@example.com' },
  });
  await prisma.user.upsert({
    where: { id: 'demo-reviewer-1-uid' },
    update: {},
    create: {
      id: 'demo-reviewer-1-uid',
      email: 'reviewer1@example.com',
      role: 'CUSTOMER',
      addresses: [],
    },
  });
  await prisma.user.upsert({
    where: { id: 'demo-reviewer-2-uid' },
    update: {},
    create: {
      id: 'demo-reviewer-2-uid',
      email: 'reviewer2@example.com',
      role: 'CUSTOMER',
      addresses: [],
    },
  });

  await prisma.review.upsert({
    where: {
      productId_userId: { productId: tee.id, userId: 'demo-buyer-uid' },
    },
    update: {},
    create: {
      productId: tee.id,
      userId: 'demo-buyer-uid',
      rating: 5,
      text: 'Washes well, no shrinking after a month.',
    },
  });
  await prisma.review.upsert({
    where: {
      productId_userId: { productId: tee.id, userId: 'demo-reviewer-1-uid' },
    },
    update: {},
    create: {
      productId: tee.id,
      userId: 'demo-reviewer-1-uid',
      rating: 4,
      text: 'Good weight, true to size. Would buy another color.',
    },
  });
  await prisma.review.upsert({
    where: {
      productId_userId: { productId: tee.id, userId: 'demo-reviewer-2-uid' },
    },
    update: {},
    create: {
      productId: tee.id,
      userId: 'demo-reviewer-2-uid',
      rating: 4,
      text: 'Soft fabric, holds up well after several washes.',
    },
  });
  await prisma.review.upsert({
    where: {
      productId_userId: { productId: hoodie.id, userId: 'demo-buyer-uid' },
    },
    update: {},
    create: {
      productId: hoodie.id,
      userId: 'demo-buyer-uid',
      rating: 5,
      text: 'Warm without being bulky. My go-to hoodie now.',
    },
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
