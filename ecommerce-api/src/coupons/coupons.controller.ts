import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Coupon } from '@prisma/client';
import { AdminGuard } from '../auth/admin.guard';
import type { AuthUser } from '../auth/auth.types';
import { CouponsService } from './coupons.service';
import {
  CouponQuoteDto,
  CouponResponseDto,
  CreateCouponDto,
  UpdateCouponDto,
  ValidateCouponDto,
} from './dto/coupon.dto';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  // Authed (non-admin) — needs the caller's identity for the once-per-customer
  // check. Returns the discount the cart should display; checkout re-validates.
  @Post('validate')
  @ApiBearerAuth()
  @ApiOkResponse({ type: CouponQuoteDto })
  async validate(
    @Body() dto: ValidateCouponDto,
    @Req() req: { user: AuthUser },
  ): Promise<CouponQuoteDto> {
    const { coupon, discountCents } = await this.coupons.quoteForUser(
      req.user.uid,
      dto.code,
      dto.subtotalCents,
    );
    return {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discountCents,
    };
  }

  @UseGuards(AdminGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOkResponse({ type: [CouponResponseDto] })
  findAll(): Promise<(Coupon & { redemptionCount: number })[]> {
    return this.coupons.findAll();
  }

  @UseGuards(AdminGuard)
  @Post()
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: CouponResponseDto })
  async create(@Body() dto: CreateCouponDto): Promise<Coupon> {
    return this.coupons.create(dto);
  }

  @UseGuards(AdminGuard)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOkResponse({ type: CouponResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto): Promise<Coupon> {
    return this.coupons.update(id, dto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOkResponse({ type: CouponResponseDto })
  remove(@Param('id') id: string): Promise<Coupon> {
    return this.coupons.remove(id);
  }
}
