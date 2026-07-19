/**
 * Seeds the franchise Brands and tags existing products by name keywords.
 * Non-destructive and idempotent: upserts brands by slug, only fills in
 * brandId on products that match a keyword, never wipes anything.
 *
 * Usage: npm run seed:brands
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// slug -> { name, keywords matched case-insensitively against product names }
const BRANDS: { name: string; slug: string; keywords: string[] }[] = [
  {
    name: 'Attack on Titan',
    slug: 'attack-on-titan',
    keywords: ['attack on titan', 'attack titan', 'eren', 'levi'],
  },
  {
    name: 'Call of Duty',
    slug: 'call-of-duty',
    keywords: ['call of duty', 'modern warfare', 'ghost led'],
  },
  {
    name: 'Tokyo Ghoul',
    slug: 'tokyo-ghoul',
    keywords: ['tokyo ghoul', 'kaneki'],
  },
  {
    name: 'BT21',
    slug: 'bt21',
    keywords: ['bt21', 'chimmy'],
  },
  {
    name: 'Chainsaw Man',
    slug: 'chainsaw-man',
    keywords: ['chainsaw man', 'aki chainsaw', 'aki led'],
  },
  {
    name: 'Naruto',
    slug: 'naruto',
    keywords: ['naruto', 'itachi', 'hidden leaf'],
  },
];

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, brandId: true },
  });

  for (const [index, def] of BRANDS.entries()) {
    const brand = await prisma.brand.upsert({
      where: { slug: def.slug },
      update: { name: def.name, sortOrder: index },
      create: { name: def.name, slug: def.slug, sortOrder: index },
    });

    const matches = products.filter((p) =>
      def.keywords.some((kw) => p.name.toLowerCase().includes(kw)),
    );
    for (const product of matches) {
      await prisma.product.update({
        where: { id: product.id },
        data: { brandId: brand.id },
      });
    }
    console.log(`${def.name}: tagged ${matches.length} product(s)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
