import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Review } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async listForProduct(productId: string): Promise<{
    items: Review[];
    averageRating: number | null;
    count: number;
  }> {
    const [items, aggregate] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);
    return {
      items,
      averageRating: aggregate._avg.rating,
      count: aggregate._count.rating,
    };
  }

  async create(
    user: AuthUser,
    productId: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    const purchased = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId: user.uid,
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
        },
      },
    });
    if (!purchased) {
      throw new ForbiddenException(
        'You can only review products you have purchased',
      );
    }
    await this.users.ensureUser(user.uid, user.email);
    try {
      return await this.prisma.review.create({
        data: {
          productId,
          userId: user.uid,
          rating: dto.rating,
          text: dto.text,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('You have already reviewed this product');
      }
      throw e;
    }
  }
}
