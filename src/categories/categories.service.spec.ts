import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('err', {
    code,
    clientVersion: 'test',
  });
}

describe('CategoriesService', () => {
  let prisma: {
    category: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: CategoriesService;

  beforeEach(() => {
    prisma = {
      category: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new CategoriesService(prisma as unknown as PrismaService);
  });

  it('findAll orders by sortOrder', async () => {
    prisma.category.findMany.mockResolvedValue([]);
    await service.findAll();
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      orderBy: { sortOrder: 'asc' },
    });
  });

  it('create passes dto through', async () => {
    prisma.category.create.mockResolvedValue({ id: 'c1' });
    await service.create({ name: 'Tees', slug: 'tees' });
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { name: 'Tees', slug: 'tees' },
    });
  });

  it('create maps duplicate slug (P2002) to ConflictException', async () => {
    prisma.category.create.mockRejectedValue(prismaError('P2002'));
    await expect(service.create({ name: 'T', slug: 'tees' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('remove maps FK violation (P2003) to ConflictException', async () => {
    prisma.category.delete.mockRejectedValue(prismaError('P2003'));
    await expect(service.remove('c1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('remove maps missing row (P2025) to NotFoundException', async () => {
    prisma.category.delete.mockRejectedValue(prismaError('P2025'));
    await expect(service.remove('c1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
