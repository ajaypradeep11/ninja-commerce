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
  let mail: { sendOrderStatusEmail: jest.Mock };
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
    mail = { sendOrderStatusEmail: jest.fn().mockResolvedValue(undefined) };
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
    await expect(service.refund('o1')).rejects.toBeInstanceOf(ConflictException);
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
        id: 'o1', userId: 'owner', status: 'PENDING', stripeSessionId: 'cs_1',
      });
      const res = await service.cancel('o1', owner);
      expect(stripe.client.checkout.sessions.expire).toHaveBeenCalledWith('cs_1');
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'o1', status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      expect(stripe.client.refunds.create).not.toHaveBeenCalled();
      expect(res).toEqual({ status: 'CANCELLED' });
    });

    it('cancels a PAID order by issuing a refund (status flips via webhook)', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1', userId: 'owner', status: 'PAID', stripePaymentIntentId: 'pi_1',
      });
      const res = await service.cancel('o1', owner);
      expect(stripe.client.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_1' });
      expect(res).toEqual({ status: 'PAID', refundId: 're_1' });
    });

    it('forbids cancelling another customer’s order', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'someone-else', status: 'PAID' });
      await expect(
        service.cancel('o1', { uid: 'intruder', email: '', admin: false }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets an admin cancel any order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1', userId: 'someone-else', status: 'PAID', stripePaymentIntentId: 'pi_9',
      });
      const res = await service.cancel('o1', { uid: 'admin', email: '', admin: true });
      expect(res.refundId).toBe('re_1');
    });

    it('rejects cancelling a SHIPPED order', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', userId: 'owner', status: 'SHIPPED' });
      await expect(service.cancel('o1', owner)).rejects.toBeInstanceOf(ConflictException);
    });

    it('refunds if a PENDING order raced to PAID (guarded update matched 0 rows)', async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce({ id: 'o1', userId: 'owner', status: 'PENDING', stripeSessionId: 'cs_1' })
        .mockResolvedValueOnce({ id: 'o1', userId: 'owner', status: 'PAID', stripePaymentIntentId: 'pi_2' });
      prisma.order.updateMany.mockResolvedValue({ count: 0 });
      const res = await service.cancel('o1', owner);
      expect(stripe.client.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_2' });
      expect(res).toEqual({ status: 'PAID', refundId: 're_1' });
    });
  });
});
