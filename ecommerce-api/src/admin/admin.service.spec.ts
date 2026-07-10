import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService, LOW_STOCK_THRESHOLD } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  const prisma = {
    order: { count: jest.fn() },
    product: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AdminService);
  });

  it('counts paid-or-later orders since UTC midnight and lists low-stock products', async () => {
    prisma.order.count.mockResolvedValue(3);
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Tee', slug: 'tee', stockQty: 2 },
    ]);

    const stats = await service.stats();

    const orderArgs = prisma.order.count.mock.calls[0][0];
    expect(orderArgs.where.status).toEqual({ notIn: ['PENDING', 'CANCELLED'] });
    const gte: Date = orderArgs.where.createdAt.gte;
    expect(gte.getUTCHours()).toBe(0);
    expect(gte.getUTCMinutes()).toBe(0);

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { active: true, stockQty: { lte: LOW_STOCK_THRESHOLD } },
      select: { id: true, name: true, slug: true, stockQty: true },
      orderBy: { stockQty: 'asc' },
    });
    expect(stats).toEqual({
      ordersToday: 3,
      lowStockProducts: [{ id: 'p1', name: 'Tee', slug: 'tee', stockQty: 2 }],
    });
  });
});
