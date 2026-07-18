/**
 * Replaces the demo apparel catalog with anime LED lamp test products whose
 * images live in the storefront repo at public/anime (served as /anime/*).
 * Each product has up to 3 photos. IMG_1157 is a personal photo and is
 * excluded; the final product only has 2 shots.
 *
 * Wipes reviews, orders and products first so the storefront only shows the
 * anime catalog. Idempotent: safe to re-run.
 *
 * Usage: npm run seed:anime
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const imgs = (...nums: (string | number)[]) =>
  nums.map((n) => `/anime/IMG_${n}.jpg`);

interface AnimeProduct {
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  images: string[];
  stockQty: number;
}

const PRODUCTS: AnimeProduct[] = [
  {
    name: 'Kobayashi LED Lamp',
    slug: 'kobayashi-led-lamp',
    description:
      "Miss Kobayashi's Dragon Maid acrylic LED lamp. 16 RGB colors with remote, runs on batteries or USB.",
    priceCents: 3999,
    images: imgs('0594', '0595', '0596'),
    stockQty: 25,
  },
  {
    name: 'Fairy Tail Guild Emblem LED Lamp',
    slug: 'fairy-tail-guild-emblem-led-lamp',
    description:
      'The Fairy Tail guild emblem as a glowing acrylic LED lamp. 16 RGB colors with remote.',
    priceCents: 4299,
    images: imgs('0597', '0598', '0600'),
    stockQty: 18,
  },
  {
    name: 'Hidden Leaf Village LED Lamp',
    slug: 'hidden-leaf-village-led-lamp',
    description:
      'Naruto Shippuden Hidden Leaf Village symbol LED lamp with 16 RGB colors and remote control.',
    priceCents: 3799,
    images: imgs('0601', '0602', '0603'),
    stockQty: 30,
  },
  {
    name: 'Ghost LED Lamp',
    slug: 'ghost-led-lamp',
    description:
      'Call of Duty: Modern Warfare II Ghost LED lamp. 16 RGB colors with remote, USB or battery powered.',
    priceCents: 4499,
    images: imgs('0604', '0605', '0606'),
    stockQty: 12,
  },
  {
    name: 'Mob Psycho LED Lamp',
    slug: 'mob-psycho-led-lamp',
    description:
      'Mob Psycho 100 acrylic LED lamp featuring Mob at full power. 16 RGB colors with remote.',
    priceCents: 3999,
    images: imgs('0607', '0608', '0609'),
    stockQty: 20,
  },
  {
    name: 'Gon & Killua LED Lamp',
    slug: 'gon-killua-led-lamp',
    description:
      'Hunter x Hunter LED lamp with Gon and Killua back to back. 16 RGB colors with remote.',
    priceCents: 4499,
    images: imgs('0610', '0611', '0612'),
    stockQty: 16,
  },
  {
    name: 'BT21 Halloween LED Lamp',
    slug: 'bt21-halloween-led-lamp',
    description:
      "BT21 Halloween edition LED lamp — the crew at a haunted doorway from Who's There?. 16 RGB colors.",
    priceCents: 2799,
    images: imgs('0616', '0617', '0618'),
    stockQty: 22,
  },
  {
    name: 'Aki LED Lamp',
    slug: 'aki-led-lamp',
    description:
      'Chainsaw Man LED lamp featuring Aki Hayakawa with his katana. 16 RGB colors with remote.',
    priceCents: 4199,
    images: imgs('0620', '0621', '0622'),
    stockQty: 14,
  },
  {
    name: 'Chainsaw Man LED Lamp',
    slug: 'chainsaw-man-led-lamp',
    description:
      'Denji in full Chainsaw Man form as a glowing acrylic LED lamp. 16 RGB colors with remote.',
    priceCents: 4599,
    images: imgs('0624', '0626', '0627'),
    stockQty: 28,
  },
  {
    name: 'Power LED Lamp',
    slug: 'power-led-lamp',
    description:
      'Chainsaw Man LED lamp featuring Power, the Blood Fiend. 16 RGB colors with remote.',
    priceCents: 4199,
    images: imgs('0628', '0629', '0630'),
    stockQty: 19,
  },
  {
    name: 'Levi LED Lamp',
    slug: 'levi-led-lamp',
    description:
      'Attack on Titan LED lamp of Captain Levi mid-strike with dual blades. 16 RGB colors with remote.',
    priceCents: 4699,
    images: imgs('0631', '0632', '0636'),
    stockQty: 15,
  },
  {
    name: 'Levi LED Lamp — Final Season',
    slug: 'levi-final-season-led-lamp',
    description:
      'Attack on Titan Final Season edition Levi LED lamp with 16 RGB colors and remote control.',
    priceCents: 4899,
    images: imgs('0639', '0637', '0638'),
    stockQty: 10,
  },
  {
    name: 'Attack Titan LED Lamp',
    slug: 'attack-titan-led-lamp',
    description:
      "Eren's Attack Titan from the Final Season as a glowing LED lamp. 16 RGB colors with remote.",
    priceCents: 4899,
    images: imgs('0642', '0640', '0641'),
    stockQty: 13,
  },
  {
    name: 'Dio LED Lamp',
    slug: 'dio-led-lamp',
    description:
      "JoJo's Bizarre Adventure: Stardust Crusaders LED lamp featuring Dio. 16 RGB colors with remote.",
    priceCents: 4499,
    images: imgs('1183', '1184', '1186'),
    stockQty: 17,
  },
  {
    name: 'Manjiro Sano LED Lamp',
    slug: 'manjiro-sano-led-lamp',
    description:
      'Tokyo Revengers LED lamp featuring Mikey, leader of the Tokyo Manji Gang. 16 RGB colors.',
    priceCents: 4299,
    images: imgs('1187', '1188', '1190'),
    stockQty: 21,
  },
  {
    name: 'Dragon Ball LED Lamp',
    slug: 'dragon-ball-led-lamp',
    description:
      'Dragon Ball Super four-star Dragon Ball LED lamp. Currently sold out — restocking soon.',
    priceCents: 3599,
    images: imgs('1191', '1193', '1195'),
    stockQty: 0,
  },
  {
    name: 'Itachi Uchiha LED Lamp',
    slug: 'itachi-uchiha-led-lamp',
    description:
      'Naruto Shippuden LED lamp featuring Itachi Uchiha, with 16 RGB colors and remote control.',
    priceCents: 4399,
    images: imgs('1196', '1198', '1199'),
    stockQty: 24,
  },
  {
    name: 'Ken Kaneki LED Lamp',
    slug: 'ken-kaneki-led-lamp',
    description:
      'Tokyo Ghoul LED lamp of Ken Kaneki, half-ghoul mask and all. 16 RGB colors with remote.',
    priceCents: 4499,
    images: imgs('1200', '1201', '1203'),
    stockQty: 26,
  },
  {
    name: 'Guts LED Lamp',
    slug: 'guts-led-lamp',
    description:
      'Berserk LED lamp of Guts with the Dragon Slayer. Only a few left in this run.',
    priceCents: 7900,
    images: imgs('1204', '1205', '1206'),
    stockQty: 3, // low stock on purpose (threshold is 5)
  },
  {
    name: 'Fairy Tail Guild LED Lamp',
    slug: 'fairy-tail-guild-led-lamp',
    description:
      'Fairy Tail LED lamp with Natsu, Lucy, Gray, Erza and Happy together. 16 RGB colors with remote.',
    priceCents: 4999,
    images: imgs('1207', '1210'),
    stockQty: 9,
  },
];

async function main(): Promise<void> {
  // This script wipes reviews, orders, products and categories. Never let it
  // run against a production database.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run seed-anime-data in production: it deletes all reviews, ' +
        'orders, products and categories.',
    );
  }

  // Old catalog rows are referenced by reviews/orders, so clear those first.
  await prisma.review.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  const lamps = await prisma.category.create({
    data: { name: 'Anime Lamps', slug: 'anime-lamps', sortOrder: 1 },
  });

  for (const product of PRODUCTS) {
    await prisma.product.create({
      data: { ...product, categoryId: lamps.id },
    });
  }

  // Keep a couple of reviews around so rating stars have data to show.
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

  const kobayashi = await prisma.product.findUniqueOrThrow({
    where: { slug: 'kobayashi-led-lamp' },
  });
  const guts = await prisma.product.findUniqueOrThrow({
    where: { slug: 'guts-led-lamp' },
  });
  await prisma.review.create({
    data: {
      productId: kobayashi.id,
      userId: 'demo-buyer-uid',
      rating: 5,
      text: 'Looks amazing on the shelf, the remote colors are great.',
    },
  });
  await prisma.review.create({
    data: {
      productId: kobayashi.id,
      userId: 'demo-reviewer-1-uid',
      rating: 4,
      text: 'Etching is crisp, box arrived in perfect shape.',
    },
  });
  await prisma.review.create({
    data: {
      productId: guts.id,
      userId: 'demo-buyer-uid',
      rating: 5,
      text: 'The Dragon Slayer glows red. Enough said.',
    },
  });

  console.log(`Anime demo data seeded: ${PRODUCTS.length} products.`);
}

void main().finally(() => prisma.$disconnect());
