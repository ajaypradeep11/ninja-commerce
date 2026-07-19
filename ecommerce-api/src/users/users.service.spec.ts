import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let prisma: { user: { upsert: jest.Mock; update: jest.Mock } };
  let service: UsersService;

  beforeEach(() => {
    prisma = { user: { upsert: jest.fn(), update: jest.fn() } };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('ensureUser upserts by uid and keeps email current', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    await service.ensureUser('u1', 'a@b.com');
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { id: 'u1' },
      create: { id: 'u1', email: 'a@b.com' },
      update: { email: 'a@b.com' },
    });
  });

  it('updateAddresses ensures the user exists then stores addresses', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockResolvedValue({ id: 'u1', addresses: [] });
    const addresses = [
      {
        line1: '1 Main St',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
      },
    ];
    await service.updateAddresses('u1', 'a@b.com', addresses);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { addresses },
    });
  });
});
