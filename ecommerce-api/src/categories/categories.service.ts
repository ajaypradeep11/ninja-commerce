import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

function mapPrismaError(e: unknown, entity: string): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      throw new ConflictException(`${entity} with this slug already exists`);
    }
    if (e.code === 'P2003') {
      throw new ConflictException(
        `${entity} is still referenced by other records`,
      );
    }
    if (e.code === 'P2025') {
      throw new NotFoundException(`${entity} not found`);
    }
  }
  throw e;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    try {
      return await this.prisma.category.create({ data: { ...dto } });
    } catch (e) {
      mapPrismaError(e, 'Category');
    }
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    try {
      return await this.prisma.category.update({
        where: { id },
        data: { ...dto },
      });
    } catch (e) {
      mapPrismaError(e, 'Category');
    }
  }

  async remove(id: string): Promise<Category> {
    try {
      return await this.prisma.category.delete({ where: { id } });
    } catch (e) {
      mapPrismaError(e, 'Category');
    }
  }
}
