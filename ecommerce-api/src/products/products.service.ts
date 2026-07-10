import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, Prisma, Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQuery } from './dto/list-products.query';
import { UpdateProductDto } from './dto/update-product.dto';

export type ProductWithRating = Product & {
  category?: Category;
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
    const { category, q, page = 1, pageSize = 12, sort } = query;
    const where: Prisma.ProductWhereInput = {
      ...(includeInactive ? {} : { active: true }),
      ...(category ? { category: { slug: category } } : {}),
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
        include: { category: true },
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
      include: { category: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const [withRating] = await this.withRatings([product]);
    return withRating;
  }

  async findBySlug(slug: string): Promise<ProductWithRating> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: { category: true },
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

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    try {
      return await this.prisma.product.update({ where: { id }, data: { ...dto } });
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
