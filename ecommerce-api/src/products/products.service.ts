import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Brand, Category, Prisma, Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BulkProductItemDto } from './dto/bulk-upload-products.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQuery } from './dto/list-products.query';
import { UpdateProductDto } from './dto/update-product.dto';

// kebab-case slug from a product name; falls back to 'product' if empty.
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'product'
  );
}

// A slug not already in `used`, suffixing -2, -3… on collision. Mutates `used`.
function uniqueSlug(name: string, used: Set<string>): string {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  used.add(slug);
  return slug;
}

export type ProductWithRating = Product & {
  category?: Category;
  brand?: Brand | null;
  averageRating: number | null;
  reviewCount: number;
};

export interface PaginatedProducts {
  items: ProductWithRating[];
  total: number;
  page: number;
  pageSize: number;
}

const SORT_MAP: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  price_asc: { priceCents: 'asc' },
  price_desc: { priceCents: 'desc' },
};

function mapPrismaError(e: unknown, entity: string): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      throw new ConflictException(`${entity} with this slug already exists`);
    }
    if (e.code === 'P2025' || e.code === 'P2003') {
      throw new NotFoundException(`${entity} or its category not found`);
    }
  }
  throw e;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private async withRatings<T extends Product>(
    products: T[],
  ): Promise<(T & { averageRating: number | null; reviewCount: number })[]> {
    if (products.length === 0) return [];
    const aggregates = await this.prisma.review.groupBy({
      by: ['productId'],
      where: { productId: { in: products.map((p) => p.id) } },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const byId = new Map(aggregates.map((a) => [a.productId, a]));
    return products.map((p) => ({
      ...p,
      averageRating: byId.get(p.id)?._avg.rating ?? null,
      reviewCount: byId.get(p.id)?._count.rating ?? 0,
    }));
  }

  async findAll(
    query: ListProductsQuery,
    includeInactive = false,
  ): Promise<PaginatedProducts> {
    const { category, brand, q, page = 1, pageSize = 12, sort } = query;
    const where: Prisma.ProductWhereInput = {
      ...(includeInactive ? {} : { active: true }),
      ...(category ? { category: { slug: category } } : {}),
      ...(brand ? { brand: { slug: brand } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { description: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true, brand: true },
        orderBy: SORT_MAP[sort ?? 'newest'],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items: await this.withRatings(products), total, page, pageSize };
  }

  async findByIdAdmin(id: string): Promise<ProductWithRating> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, brand: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const [withRating] = await this.withRatings([product]);
    return withRating;
  }

  async findBySlug(slug: string): Promise<ProductWithRating> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: { category: true, brand: true },
    });
    if (!product || !product.active) {
      throw new NotFoundException('Product not found');
    }
    const [withRating] = await this.withRatings([product]);
    return withRating;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    try {
      return await this.prisma.product.create({ data: { ...dto } });
    } catch (e) {
      mapPrismaError(e, 'Product');
    }
  }

  // Bulk-create products from parsed CSV rows. Valid rows are created in one
  // transaction; invalid rows (empty name, bad price/stock, unknown category)
  // are skipped and reported so the caller can fix and re-upload just those.
  async bulkCreate(
    items: BulkProductItemDto[],
  ): Promise<{ created: number; errors: { row: number; message: string }[] }> {
    const categories = await this.prisma.category.findMany();
    const catByName = new Map(
      categories.map((c) => [c.name.trim().toLowerCase(), c.id]),
    );
    const existing = await this.prisma.product.findMany({
      select: { slug: true },
    });
    const usedSlugs = new Set(existing.map((p) => p.slug));

    const toCreate: Prisma.ProductCreateInput[] = [];
    const errors: { row: number; message: string }[] = [];

    items.forEach((item, i) => {
      const row = i + 1;
      const name = (item.name ?? '').trim();
      if (!name) {
        errors.push({ row, message: 'name is required' });
        return;
      }
      if (!Number.isInteger(item.priceCents) || (item.priceCents ?? -1) < 0) {
        errors.push({ row, message: `invalid price for "${name}"` });
        return;
      }
      if (!Number.isInteger(item.stockQty) || (item.stockQty ?? -1) < 0) {
        errors.push({ row, message: `invalid stock for "${name}"` });
        return;
      }
      const categoryId = catByName.get(
        (item.categoryName ?? '').trim().toLowerCase(),
      );
      if (!categoryId) {
        errors.push({
          row,
          message: `unknown category "${item.categoryName ?? ''}" for "${name}"`,
        });
        return;
      }
      toCreate.push({
        name,
        slug: uniqueSlug(name, usedSlugs),
        description: (item.description ?? '').trim(),
        priceCents: item.priceCents!,
        stockQty: item.stockQty!,
        images: [],
        active: item.active ?? true,
        category: { connect: { id: categoryId } },
      });
    });

    if (toCreate.length > 0) {
      await this.prisma.$transaction(
        toCreate.map((data) => this.prisma.product.create({ data })),
      );
    }
    return { created: toCreate.length, errors };
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    try {
      return await this.prisma.product.update({
        where: { id },
        data: { ...dto },
      });
    } catch (e) {
      mapPrismaError(e, 'Product');
    }
  }

  async deactivate(id: string): Promise<Product> {
    try {
      return await this.prisma.product.update({
        where: { id },
        data: { active: false },
      });
    } catch (e) {
      mapPrismaError(e, 'Product');
    }
  }

  async adjustStock(id: string, delta: number): Promise<Product> {
    const exists = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Product not found');

    const where: Prisma.ProductWhereInput & { id: string } =
      delta < 0 ? { id, stockQty: { gte: -delta } } : { id };
    const result = await this.prisma.product.updateMany({
      where,
      data: { stockQty: { increment: delta } },
    });
    if (result.count === 0) {
      throw new ConflictException('Insufficient stock');
    }
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
}
