import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { CheckoutSessionResponseDto } from './dto/checkout-response.dto';

@ApiBearerAuth()
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @ApiOperation({ summary: 'Create a Stripe Checkout session for the current cart' })
  @ApiCreatedResponse({ type: CheckoutSessionResponseDto })
  // Stricter than the global default: checkout creates orders + Stripe sessions.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCheckoutDto,
  ): Promise<{ url: string; orderId: string }> {
    return this.checkout.createSession(user, dto);
  }
}
