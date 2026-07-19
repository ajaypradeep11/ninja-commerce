import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

const user = { uid: 'u1', email: 'a@b.com', admin: false };

describe('ReviewsService', () => {
  let prisma: {
    review: { findMany: jest.Mock; aggregate: jest.Mock; create: jest.Mock };
    orderItem: { findFirst: jest.Mock };
  };
  let users: { ensureUser: jest.Mock };
  let service: ReviewsService;

  beforeEach(() => {
    prisma = {
      review: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({
          _avg: { rating: null },
          _count: { rating: 0 },
        }),
        create: jest.fn(),
      },
      orderItem: { findFirst: jest.fn() },
    };
    users = { ensureUser: jest.fn().mockResolvedValue({ id: 'u1' }) };
    service = new ReviewsService(
      prisma as unknown as PrismaService,
      users as unknown as UsersService,
    );
  });

  it('rejects reviews from users who have not purchased the product', async () => {
    prisma.orderItem.findFirst.mockResolvedValue(null);
    await expect(
      service.create(user, 'p1', { rating: 5, text: 'great' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.orderItem.findFirst).toHaveBeenCalledWith({
      where: {
        productId: 'p1',
        order: {
          userId: 'u1',
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        },
      },
    });
  });

  it('creates a review for a verified purchaser', async () => {
    prisma.orderItem.findFirst.mockResolvedValue({ id: 'oi1' });
    prisma.review.create.mockResolvedValue({ id: 'r1' });
    await service.create(user, 'p1', { rating: 4, text: 'nice' });
    expect(prisma.review.create).toHaveBeenCalledWith({
      data: { productId: 'p1', userId: 'u1', rating: 4, text: 'nice' },
    });
  });

  it('maps duplicate review (P2002) to ConflictException', async () => {
    prisma.orderItem.findFirst.mockResolvedValue({ id: 'oi1' });
    prisma.review.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.create(user, 'p1', { rating: 4, text: 'again' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('listForProduct returns items with aggregate', async () => {
    prisma.review.aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { rating: 2 },
    });
    const result = await service.listForProduct('p1');
    expect(result).toMatchObject({ averageRating: 4.5, count: 2 });
  });
});
