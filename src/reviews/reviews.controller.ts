import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { Review } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get()
  list(@Param('productId') productId: string) {
    return this.reviews.listForProduct(productId);
  }

  @Post()
  create(
    @Param('productId') productId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReviewDto,
  ): Promise<Review> {
    return this.reviews.create(user, productId, dto);
  }
}
