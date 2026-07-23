import type { ConfigService } from '@nestjs/config';
import type { Order } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

const createTransport = nodemailer.createTransport as jest.Mock;

function configWith(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order_abc12345',
    userId: 'u1',
    email: 'buyer@example.com',
    status: 'SHIPPED',
    currency: 'CAD',
    stripeSessionId: null,
    stripePaymentIntentId: null,
    shippingAddress: null,
    subtotalCents: 5000,
    taxCents: 650,
    totalCents: 5650,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('MailService', () => {
  let sendMail: jest.Mock;

  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue({});
    createTransport.mockReset().mockReturnValue({ sendMail });
  });

  it('skips sending (no transport) when SMTP_HOST is unset', async () => {
    const service = new MailService(configWith({}));
    await service.sendOrderStatusEmail(order());
    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends a shipped email from the support address', async () => {
    const service = new MailService(configWith({ SMTP_HOST: 'smtp.test' }));
    await service.sendOrderStatusEmail(order());
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'LocalNinja Support <support@localninja.ca>',
        to: 'buyer@example.com',
        subject: expect.stringMatching(/shipped/i),
        text: expect.stringContaining('support@localninja.ca'),
      }),
    );
  });

  it('sends a delivered email for DELIVERED status', async () => {
    const service = new MailService(configWith({ SMTP_HOST: 'smtp.test' }));
    await service.sendOrderStatusEmail(order({ status: 'DELIVERED' }));
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringMatching(/delivered/i) }),
    );
  });

  it('sends nothing for statuses without customer-facing copy', async () => {
    const service = new MailService(configWith({ SMTP_HOST: 'smtp.test' }));
    await service.sendOrderStatusEmail(order({ status: 'PENDING' }));
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('swallows transport errors instead of throwing', async () => {
    sendMail.mockRejectedValue(new Error('smtp down'));
    const service = new MailService(configWith({ SMTP_HOST: 'smtp.test' }));
    await expect(
      service.sendOrderStatusEmail(order()),
    ).resolves.toBeUndefined();
  });

  it('honors MAIL_FROM override', async () => {
    const service = new MailService(
      configWith({ SMTP_HOST: 'smtp.test', MAIL_FROM: 'Ops <ops@x.ca>' }),
    );
    await service.sendOrderStatusEmail(order());
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Ops <ops@x.ca>' }),
    );
  });

  describe('sendReturnRequestedEmails', () => {
    it('confirms with the customer and alerts support, in one call', async () => {
      const service = new MailService(configWith({ SMTP_HOST: 'smtp.test' }));
      await service.sendReturnRequestedEmails(
        order({ returnReason: 'Wrong size' } as Partial<Order>),
      );

      expect(sendMail).toHaveBeenCalledTimes(2);
      expect(sendMail).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          to: 'buyer@example.com',
          subject: expect.stringMatching(/return request/i),
        }),
      );
      expect(sendMail).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          to: 'support@localninja.ca',
          subject: expect.stringContaining('ABC12345'),
          text: expect.stringContaining('Wrong size'),
        }),
      );
    });

    it('omits the reason line when no reason was given', async () => {
      const service = new MailService(configWith({ SMTP_HOST: 'smtp.test' }));
      await service.sendReturnRequestedEmails(order());

      const supportCall = sendMail.mock.calls[1][0];
      expect(supportCall.text).not.toMatch(/Reason:/);
    });

    it('still emails the customer even if the support alert fails', async () => {
      sendMail
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('smtp down'));
      const service = new MailService(configWith({ SMTP_HOST: 'smtp.test' }));
      await expect(
        service.sendReturnRequestedEmails(order()),
      ).resolves.toBeUndefined();
      expect(sendMail).toHaveBeenCalledTimes(2);
    });

    it('skips sending (logs only) when SMTP is unconfigured', async () => {
      const service = new MailService(configWith({}));
      await service.sendReturnRequestedEmails(order());
      expect(sendMail).not.toHaveBeenCalled();
    });
  });
});
