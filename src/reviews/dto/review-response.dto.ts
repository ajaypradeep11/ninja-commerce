import { ApiProperty } from '@nestjs/swagger';

export class ReviewResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) rating!: number;
  @ApiProperty() text!: string;
  @ApiProperty() createdAt!: Date;
}

export class ProductReviewsResponseDto {
  @ApiProperty({ type: [ReviewResponseDto] }) items!: ReviewResponseDto[];
  @ApiProperty({ type: Number, nullable: true }) averageRating!: number | null;
  @ApiProperty() count!: number;
}
