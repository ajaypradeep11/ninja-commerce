import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProductsService', () => {
  let prisma: {
    product: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    review: { groupBy: jest.Mock };
  };
  let service: ProductsService;

  beforeEach(() => {
    prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      review: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    service = new ProductsService(prisma as unknown as PrismaService);
  });

  it('findAll filters to active products with category slug and search text', async () => {
    await service.findAll({ category: 'tees', q: 'polka', page: 2, pageSize: 12, sort: 'price_asc' });
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        category: { slug: 'tees' },
        OR: [
          { name: { contains: 'polka', mode: 'insensitive' } },
          { description: { contains: 'polka', mode: 'insensitive' } },
        ],
      },
      include: { category: true },
      orderBy: { priceCents: 'asc' },
      skip: 12,
      take: 12,
    });
  });

  it('findAll includes inactive products when includeInactive', async () => {
    await service.findAll({ page: 1, pageSize: 12 }, true);
    const where = prisma.product.findMany.mock.calls[0][0].where;
    expect(where.active).toBeUndefined();
  });

  it('findAll merges review aggregates into items', async () => {
    prisma.product.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    prisma.product.count.mockResolvedValue(2);
    prisma.review.groupBy.mockResolvedValue([
      { productId: 'p1', _avg: { rating: 4.5 }, _count: { rating: 2 } },
    ]);
    const result = await service.findAll({ page: 1, pageSize: 12 });
    expect(result.items[0]).toMatchObject({ id: 'p1', averageRating: 4.5, reviewCount: 2 });
    expect(result.items[1]).toMatchObject({ id: 'p2', averageRating: null, reviewCount: 0 });
    expect(result.total).toBe(2);
  });

  it('findBySlug throws 404 for inactive product', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'p1', active: false });
    await expect(service.findBySlug('gone')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adjustStock guards against going negative', async () => {
    prisma.product.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.adjustStock('p1', -5)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', stockQty: { gte: 5 } },
      data: { stockQty: { increment: -5 } },
    });
  });

  it('adjustStock increments without guard for positive delta', async () => {
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.findUnique.mockResolvedValue({ id: 'p1', stockQty: 15 });
    await service.adjustStock('p1', 10);
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { stockQty: { increment: 10 } },
    });
  });

  it('deactivate sets active false', async () => {
    prisma.product.update.mockResolvedValue({ id: 'p1', active: false });
    await service.deactivate('p1');
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { active: false },
    });
  });
});
