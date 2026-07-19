import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BrandsService } from './brands.service';
import { PrismaService } from '../prisma/prisma.service';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('err', {
    code,
    clientVersion: 'test',
  });
}

describe('BrandsService', () => {
  let prisma: {
    brand: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: BrandsService;

  beforeEach(() => {
    prisma = {
      brand: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new BrandsService(prisma as unknown as PrismaService);
  });

  it('findAll orders by sortOrder then name', async () => {
    prisma.brand.findMany.mockResolvedValue([]);
    await service.findAll();
    expect(prisma.brand.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  });

  it('create passes dto through', async () => {
    prisma.brand.create.mockResolvedValue({ id: 'b1' });
    await service.create({ name: 'Naruto', slug: 'naruto' });
    expect(prisma.brand.create).toHaveBeenCalledWith({
      data: { name: 'Naruto', slug: 'naruto' },
    });
  });

  it('create maps duplicate slug (P2002) to ConflictException', async () => {
    prisma.brand.create.mockRejectedValue(prismaError('P2002'));
    await expect(
      service.create({ name: 'N', slug: 'naruto' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('remove maps missing row (P2025) to NotFoundException', async () => {
    prisma.brand.delete.mockRejectedValue(prismaError('P2025'));
    await expect(service.remove('b1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
