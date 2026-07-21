import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';

describe('OrdersService', () => {
  let prisma: {
    order: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let stripe: {
    client: {
      refunds: { create: jest.Mock };
      checkout: { sessions: { expire: jest.Mock } };
    };
  };
  let mail: {
    sendOrderStatusEmail: jest.Mock;
    sendReturnRequestedEmails: jest.Mock;
  };
  let service: OrdersService;

  beforeEach(() => {
    prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    stripe = {
      client: {
        refunds: { create: jest.fn().mockResolvedValue({ id: 're_1' }) },
        checkout: { sessions: { expire: jest.fn().mockResolvedValue({}) } },
      },
    };
    mail = {
      sendOrderStatusEmail: jest.fn().mockResolvedValue(undefined),
      sendReturnRequestedEmails: jest.fn().mockResolvedValue(undefined),
    };
    service = new OrdersService(
      prisma as unknown as PrismaService,
      stripe as unknown as StripeService,
      mail as unknown as MailService,
    );
  });

  it('findForUser returns own orders newest first with items', async () => {
    await service.findForUser('u1');
    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findOne forbids other customers', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'owner' });
    await expect(
      service.findOne('o1', { uid: 'intruder', email: '', admin: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('findOne allows admin', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'owner' });
    await expect(
      service.findOne('o1', { uid: 'other', email: '', admin: true }),
    ).resolves.toMatchObject({ id: 'o1' });
  });

  it('findOne 404s on unknown order', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(
      service.findOne('nope', { uid: 'u', email: '', admin: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateStatus allows PAID -> SHIPPED', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'PAID' });
    prisma.order.update.mockResolvedValue({ id: 'o1', status: 'SHIPPED' });
    await service.updateStatus('o1', 'SHIPPED');
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'SHIPPED' },
    });
  });

  it('updateStatus emails the customer with the updated order', async () => {
    const updated = {
      id: 'o1',
      status: 'SHIPPED',
      email: 'buyer@example.com',
    };
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'PAID' });
    prisma.order.update.mockResolvedValue(updated);
    await service.updateStatus('o1', 'SHIPPED');
    expect(mail.sendOrderStatusEmail).toHaveBeenCalledWith(updated);
  });

  it('updateStatus rejects invalid transition PENDING -> SHIPPED', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'PENDING' });
    await expect(service.updateStatus('o1', 'SHIPPED')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(mail.sendOrderStatusEmail).not.toHaveBeenCalled();
  });

  it('updateStatus stamps deliveredAt on the SHIPPED -> DELIVERED leg', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'SHIPPED' });
    prisma.order.update.mockResolvedValue({ id: 'o1', status: 'DELIVERED' });
    await service.updateStatus('o1', 'DELIVERED');
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'DELIVERED', deliveredAt: expect.any(Date) },
    });
  });

  it('refund calls Stripe with the payment intent', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'PAID',
      stripePaymentIntentId: 'pi_1',
    });
    stripe.client.refunds.create.mockResolvedValue({ id: 're_1' });
    const result = await service.refund('o1');
    expect(stripe.client.refunds.create).toHaveBeenCalledWith({
      payment_intent: 'pi_1',
    });
    expect(result).toEqual({ refundId: 're_1' });
  });

  it('refund rejects orders that are not paid yet', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      status: 'PENDING',
      stripePaymentIntentId: null,
    });
    await expect(service.refund('o1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('filters by email case-insensitively', async () => {
    prisma.order.findMany.mockResolvedValue([]);
    prisma.order.count.mockResolvedValue(0);

    await service.findAll({ email: 'Buyer@', page: 1, pageSize: 20 });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { contains: 'Buyer@', mode: 'insensitive' } },
      }),
    );
  });

  describe('cancel', () => {
    const owner = { uid: 'owner', email: 'o@x.com', admin: false };

    it('cancels an unpaid PENDING order: expires the session, marks CANCELLED, no refund', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'owner',
        status: 'PENDING',
        stripeSessionId: 'cs_1',
      });
      const res = await service.cancel('o1', owner);
      expect(stripe.client.checkout.sessions.expire).toHaveBeenCalledWith(
        'cs_1',
      );
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'o1', status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      expect(stripe.client.refunds.create).not.toHaveBeenCalled();
      expect(res).toEqual({ status: 'CANCELLED' });
    });

    it('cancels a PAID order by issuing a refund (status flips via webhook)', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'owner',
        status: 'PAID',
        stripePaymentIntentId: 'pi_1',
      });
      const res = await service.cancel('o1', owner);
      expect(stripe.client.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_1',
      });
      expect(res).toEqual({ status: 'PAID', refundId: 're_1' });
    });

    it('forbids cancelling another customer’s order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'someone-else',
        status: 'PAID',
      });
      await expect(
        service.cancel('o1', { uid: 'intruder', email: '', admin: false }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets an admin cancel any order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'someone-else',
        status: 'PAID',
        stripePaymentIntentId: 'pi_9',
      });
      const res = await service.cancel('o1', {
        uid: 'admin',
        email: '',
        admin: true,
      });
      expect(res.refundId).toBe('re_1');
    });

    it('rejects cancelling a SHIPPED order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'owner',
        status: 'SHIPPED',
      });
      await expect(service.cancel('o1', owner)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('refunds if a PENDING order raced to PAID (guarded update matched 0 rows)', async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce({
          id: 'o1',
          userId: 'owner',
          status: 'PENDING',
          stripeSessionId: 'cs_1',
        })
        .mockResolvedValueOnce({
          id: 'o1',
          userId: 'owner',
          status: 'PAID',
          stripePaymentIntentId: 'pi_2',
        });
      prisma.order.updateMany.mockResolvedValue({ count: 0 });
      const res = await service.cancel('o1', owner);
      expect(stripe.client.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_2',
      });
      expect(res).toEqual({ status: 'PAID', refundId: 're_1' });
    });
  });

  describe('requestReturn', () => {
    const owner = { uid: 'owner', email: 'o@x.com', admin: false };
    const now = Date.now();
    const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

    it('flags a recently delivered order and emails the customer + support', async () => {
      const delivered = {
        id: 'o1',
        userId: 'owner',
        status: 'DELIVERED',
        deliveredAt: daysAgo(5),
        returnRequestedAt: null,
      };
      const updated = { ...delivered, returnRequestedAt: new Date(), returnReason: 'Wrong size' };
      prisma.order.findUnique.mockResolvedValue(delivered);
      prisma.order.update.mockResolvedValue(updated);

      const res = await service.requestReturn('o1', owner, 'Wrong size');

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { returnRequestedAt: expect.any(Date), returnReason: 'Wrong size' },
      });
      expect(mail.sendReturnRequestedEmails).toHaveBeenCalledWith(updated);
      expect(res).toEqual(updated);
    });

    it('defaults returnReason to null when no reason is given', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'owner',
        status: 'DELIVERED',
        deliveredAt: daysAgo(1),
        returnRequestedAt: null,
      });
      prisma.order.update.mockResolvedValue({ id: 'o1' });

      await service.requestReturn('o1', owner);

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ returnReason: null }) }),
      );
    });

    it('rejects a non-delivered order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'owner',
        status: 'SHIPPED',
        deliveredAt: null,
      });
      await expect(service.requestReturn('o1', owner)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(mail.sendReturnRequestedEmails).not.toHaveBeenCalled();
    });

    it('rejects once the 30-day window has closed', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'owner',
        status: 'DELIVERED',
        deliveredAt: daysAgo(31),
        returnRequestedAt: null,
      });
      await expect(service.requestReturn('o1', owner)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects a second return request on the same order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'owner',
        status: 'DELIVERED',
        deliveredAt: daysAgo(2),
        returnRequestedAt: daysAgo(1),
      });
      await expect(service.requestReturn('o1', owner)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('forbids requesting a return on another customer’s order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'someone-else',
        status: 'DELIVERED',
        deliveredAt: daysAgo(1),
        returnRequestedAt: null,
      });
      await expect(
        service.requestReturn('o1', { uid: 'intruder', email: '', admin: false }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets an admin request a return on any order', async () => {
      const delivered = {
        id: 'o1',
        userId: 'someone-else',
        status: 'DELIVERED',
        deliveredAt: daysAgo(1),
        returnRequestedAt: null,
      };
      prisma.order.findUnique.mockResolvedValue(delivered);
      prisma.order.update.mockResolvedValue({ ...delivered, returnRequestedAt: new Date() });
      await expect(
        service.requestReturn('o1', { uid: 'admin', email: '', admin: true }),
      ).resolves.toMatchObject({ id: 'o1' });
    });

    it('404s on an unknown order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.requestReturn('nope', owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
