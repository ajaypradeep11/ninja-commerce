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
    await service.findAll({
      category: 'tees',
      q: 'polka',
      page: 2,
      pageSize: 12,
      sort: 'price_asc',
    });
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        category: { slug: 'tees' },
        OR: [
          { name: { contains: 'polka', mode: 'insensitive' } },
          { description: { contains: 'polka', mode: 'insensitive' } },
        ],
      },
      include: { category: true, brand: true },
      orderBy: { priceCents: 'asc' },
      skip: 12,
      take: 12,
    });
  });

  it('findAll filters by brand slug', async () => {
    await service.findAll({ brand: 'naruto', page: 1, pageSize: 12 });
    const where = prisma.product.findMany.mock.calls[0][0].where;
    expect(where.brand).toEqual({ slug: 'naruto' });
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
    expect(result.items[0]).toMatchObject({
      id: 'p1',
      averageRating: 4.5,
      reviewCount: 2,
    });
    expect(result.items[1]).toMatchObject({
      id: 'p2',
      averageRating: null,
      reviewCount: 0,
    });
    expect(result.total).toBe(2);
  });

  it('findBySlug throws 404 for inactive product', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'p1', active: false });
    await expect(service.findBySlug('gone')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('adjustStock guards against going negative', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.product.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.adjustStock('p1', -5)).rejects.toBeInstanceOf(
      ConflictException,
    );
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

  it('adjustStock 404s on unknown product', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(service.adjustStock('missing', 5)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.product.updateMany).not.toHaveBeenCalled();
  });

  it('deactivate sets active false', async () => {
    prisma.product.update.mockResolvedValue({ id: 'p1', active: false });
    await service.deactivate('p1');
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { active: false },
    });
  });

  describe('findByIdAdmin', () => {
    it('returns an inactive product with rating aggregates', async () => {
      const product = {
        id: 'p1',
        name: 'Tee',
        slug: 'tee',
        active: false,
        category: { id: 'c1' },
      };
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.review.groupBy.mockResolvedValue([
        { productId: 'p1', _avg: { rating: 4 }, _count: { rating: 2 } },
      ]);

      const result = await service.findByIdAdmin('p1');

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'p1' },
        include: { category: true, brand: true },
      });
      expect(result.averageRating).toBe(4);
      expect(result.reviewCount).toBe(2);
      expect(result.active).toBe(false);
    });

    it('throws NotFoundException when the product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.findByIdAdmin('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('bulkCreate', () => {
    // Fresh mock capturing created rows; category "Anime Lamps" exists as cat1.
    function makeService(existingSlugs: string[] = []) {
      const created: {
        data: { slug: string; name: string; categoryId?: string };
      }[] = [];
      const p = {
        category: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: 'cat1', name: 'Anime Lamps' }]),
        },
        product: {
          findMany: jest
            .fn()
            .mockResolvedValue(existingSlugs.map((slug) => ({ slug }))),
          create: jest.fn(
            (args: { data: { category?: { connect?: { id: string } } } }) => {
              created.push(args as never);
              return args;
            },
          ),
        },
        $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
      };
      const svc = new ProductsService(p as unknown as PrismaService);
      return { svc, created, p };
    }

    it('creates valid rows and resolves category by name (case-insensitive)', async () => {
      const { svc, created } = makeService();
      const res = await svc.bulkCreate([
        {
          name: 'Naruto Lamp',
          priceCents: 3999,
          stockQty: 5,
          categoryName: 'anime lamps',
        },
        {
          name: 'Goku Lamp',
          description: 'saiyan',
          priceCents: 4999,
          stockQty: 2,
          categoryName: 'Anime Lamps',
          active: false,
        },
      ]);
      expect(res).toEqual({ created: 2, errors: [] });
      expect(created.map((c) => c.data.slug)).toEqual([
        'naruto-lamp',
        'goku-lamp',
      ]);
      expect((created[0].data as any).category).toEqual({
        connect: { id: 'cat1' },
      });
      expect((created[1].data as any).active).toBe(false);
    });

    it('skips a row with an unknown category but imports the rest', async () => {
      const { svc, created } = makeService();
      const res = await svc.bulkCreate([
        {
          name: 'Good',
          priceCents: 1000,
          stockQty: 1,
          categoryName: 'Anime Lamps',
        },
        { name: 'Bad', priceCents: 1000, stockQty: 1, categoryName: 'Nope' },
      ]);
      expect(res.created).toBe(1);
      expect(created).toHaveLength(1);
      expect(res.errors).toEqual([
        { row: 2, message: 'unknown category "Nope" for "Bad"' },
      ]);
    });

    it('reports rows with an empty name or bad price/stock', async () => {
      const { svc } = makeService();
      const res = await svc.bulkCreate([
        {
          name: '  ',
          priceCents: 1000,
          stockQty: 1,
          categoryName: 'Anime Lamps',
        },
        { name: 'X', priceCents: -5, stockQty: 1, categoryName: 'Anime Lamps' },
        {
          name: 'Y',
          priceCents: 100,
          stockQty: 1.5,
          categoryName: 'Anime Lamps',
        },
      ]);
      expect(res.created).toBe(0);
      expect(res.errors.map((e) => e.row)).toEqual([1, 2, 3]);
    });

    it('auto-suffixes duplicate slugs (within batch and vs existing)', async () => {
      const { svc, created } = makeService(['naruto-lamp']);
      await svc.bulkCreate([
        {
          name: 'Naruto Lamp',
          priceCents: 100,
          stockQty: 1,
          categoryName: 'Anime Lamps',
        },
        {
          name: 'Naruto Lamp',
          priceCents: 100,
          stockQty: 1,
          categoryName: 'Anime Lamps',
        },
      ]);
      expect(created.map((c) => c.data.slug)).toEqual([
        'naruto-lamp-2',
        'naruto-lamp-3',
      ]);
    });
  });
});
