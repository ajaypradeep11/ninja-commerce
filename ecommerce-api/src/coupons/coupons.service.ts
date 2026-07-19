import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Coupon, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';

function mapPrismaError(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      throw new ConflictException('Coupon with this code already exists');
    }
    if (e.code === 'P2003') {
      throw new ConflictException(
        'Coupon has redemptions — deactivate it instead of deleting',
      );
    }
    if (e.code === 'P2025') {
      throw new NotFoundException('Coupon not found');
    }
  }
  throw e;
}

export interface CouponQuote {
  coupon: Coupon;
  discountCents: number;
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<(Coupon & { redemptionCount: number })[]> {
    const coupons = await this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    });
    return coupons.map(({ _count, ...coupon }) => ({
      ...coupon,
      redemptionCount: _count.redemptions,
    }));
  }

  private assertValueShape(type: string, value: number): void {
    if (type === 'PERCENT' && (value < 1 || value > 100)) {
      throw new BadRequestException('Percent value must be between 1 and 100');
    }
  }

  async create(dto: CreateCouponDto): Promise<Coupon> {
    this.assertValueShape(dto.type, dto.value);
    try {
      return await this.prisma.coupon.create({ data: { ...dto } });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async update(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    if (dto.type && dto.value !== undefined) {
      this.assertValueShape(dto.type, dto.value);
    }
    try {
      return await this.prisma.coupon.update({ where: { id }, data: { ...dto } });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async remove(id: string): Promise<Coupon> {
    try {
      return await this.prisma.coupon.delete({ where: { id } });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  /**
   * The one source of truth for whether `code` is usable by `userId` and what
   * it is worth against `subtotalCents`. Used by the cart's validate endpoint
   * and re-run inside checkout session creation (never trust client math).
   */
  async quoteForUser(
    userId: string,
    code: string,
    subtotalCents: number,
  ): Promise<CouponQuote> {
    const normalized = code.trim().toUpperCase();
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: normalized },
    });
    if (!coupon || !coupon.active) {
      throw new NotFoundException('Invalid coupon code');
    }
    const redeemed = await this.prisma.couponRedemption.findUnique({
      where: { couponId_userId: { couponId: coupon.id, userId } },
    });
    if (redeemed) {
      throw new ConflictException('You have already used this coupon');
    }
    const discountCents =
      coupon.type === 'PERCENT'
        ? Math.floor((subtotalCents * coupon.value) / 100)
        : Math.min(coupon.value, subtotalCents);
    return { coupon, discountCents };
  }
}
