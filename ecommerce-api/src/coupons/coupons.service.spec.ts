import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CouponsService } from './coupons.service';
import { PrismaService } from '../prisma/prisma.service';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('err', {
    code,
    clientVersion: 'test',
  });
}

describe('CouponsService', () => {
  let prisma: {
    coupon: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    couponRedemption: { findUnique: jest.Mock };
  };
  let service: CouponsService;

  beforeEach(() => {
    prisma = {
      coupon: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      couponRedemption: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    service = new CouponsService(prisma as unknown as PrismaService);
  });

  describe('quoteForUser', () => {
    const percent10 = { id: 'c1', code: 'SAVE10', type: 'PERCENT', value: 10, active: true };

    it('404s on an unknown code', async () => {
      prisma.coupon.findUnique.mockResolvedValue(null);
      await expect(
        service.quoteForUser('u1', 'nope', 1000, 'CAD'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s on an inactive code', async () => {
      prisma.coupon.findUnique.mockResolvedValue({ ...percent10, active: false });
      await expect(
        service.quoteForUser('u1', 'SAVE10', 1000, 'CAD'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409s when the user already redeemed the coupon', async () => {
      prisma.coupon.findUnique.mockResolvedValue(percent10);
      prisma.couponRedemption.findUnique.mockResolvedValue({ id: 'r1' });
      await expect(
        service.quoteForUser('u1', 'SAVE10', 1000, 'CAD'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('normalizes the code and floors percent discounts', async () => {
      prisma.coupon.findUnique.mockResolvedValue(percent10);
      const quote = await service.quoteForUser('u1', '  save10 ', 1099, 'CAD');
      expect(prisma.coupon.findUnique).toHaveBeenCalledWith({
        where: { code: 'SAVE10' },
      });
      expect(quote.discountCents).toBe(109); // floor(1099 * 10%)
    });

    it('clamps fixed discounts to the subtotal', async () => {
      prisma.coupon.findUnique.mockResolvedValue({
        id: 'c2',
        code: 'FIVE',
        type: 'FIXED',
        value: 500,
        active: true,
      });
      const quote = await service.quoteForUser('u1', 'FIVE', 300, 'CAD');
      expect(quote.discountCents).toBe(300);
    });
  });

  describe('currency rules', () => {
    it('allows a PERCENT coupon on a USD cart', async () => {
      prisma.coupon.findUnique.mockResolvedValue({
        id: 'c1', code: 'TENOFF', type: 'PERCENT', value: 10, active: true,
      });
      prisma.couponRedemption.findUnique.mockResolvedValue(null);

      const quote = await service.quoteForUser('u1', 'TENOFF', 10000, 'USD');

      expect(quote.discountCents).toBe(1000);
    });

    it('rejects a FIXED coupon on a USD cart', async () => {
      prisma.coupon.findUnique.mockResolvedValue({
        id: 'c2', code: 'TENBUCKS', type: 'FIXED', value: 1000, active: true,
      });
      prisma.couponRedemption.findUnique.mockResolvedValue(null);

      await expect(
        service.quoteForUser('u1', 'TENBUCKS', 10000, 'USD'),
      ).rejects.toThrow('This code is valid on CAD orders only');
    });

    it('still allows a FIXED coupon on a CAD cart', async () => {
      prisma.coupon.findUnique.mockResolvedValue({
        id: 'c2', code: 'TENBUCKS', type: 'FIXED', value: 1000, active: true,
      });
      prisma.couponRedemption.findUnique.mockResolvedValue(null);

      const quote = await service.quoteForUser('u1', 'TENBUCKS', 10000, 'CAD');

      expect(quote.discountCents).toBe(1000);
    });
  });

  it('create rejects percent values over 100', async () => {
    await expect(
      service.create({ code: 'BAD', type: 'PERCENT', value: 150 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create maps duplicate code (P2002) to ConflictException', async () => {
    prisma.coupon.create.mockRejectedValue(prismaError('P2002'));
    await expect(
      service.create({ code: 'DUP', type: 'FIXED', value: 500 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('remove maps redeemed coupons (P2003) to ConflictException', async () => {
    prisma.coupon.delete.mockRejectedValue(prismaError('P2003'));
    await expect(service.remove('c1')).rejects.toBeInstanceOf(ConflictException);
  });
});
