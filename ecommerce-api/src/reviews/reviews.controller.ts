import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Review } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  ProductReviewsResponseDto,
  ReviewResponseDto,
} from './dto/review-response.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @ApiOkResponse({ type: ProductReviewsResponseDto })
  @Get()
  list(@Param('productId') productId: string) {
    return this.reviews.listForProduct(productId);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a review (purchase-gated, one per user per product)',
  })
  @ApiCreatedResponse({ type: ReviewResponseDto })
  @Post()
  create(
    @Param('productId') productId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReviewDto,
  ): Promise<Review> {
    return this.reviews.create(user, productId, dto);
  }
}
