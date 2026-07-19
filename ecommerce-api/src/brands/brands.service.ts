import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Brand, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

function mapPrismaError(e: unknown, entity: string): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      throw new ConflictException(`${entity} with this slug already exists`);
    }
    if (e.code === 'P2025') {
      throw new NotFoundException(`${entity} not found`);
    }
  }
  throw e;
}

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Brand[]> {
    return this.prisma.brand.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateBrandDto): Promise<Brand> {
    try {
      return await this.prisma.brand.create({ data: { ...dto } });
    } catch (e) {
      mapPrismaError(e, 'Brand');
    }
  }

  async update(id: string, dto: UpdateBrandDto): Promise<Brand> {
    try {
      return await this.prisma.brand.update({
        where: { id },
        data: { ...dto },
      });
    } catch (e) {
      mapPrismaError(e, 'Brand');
    }
  }

  // Products referencing this brand fall back to brandId = null (SetNull).
  async remove(id: string): Promise<Brand> {
    try {
      return await this.prisma.brand.delete({ where: { id } });
    } catch (e) {
      mapPrismaError(e, 'Brand');
    }
  }
}
