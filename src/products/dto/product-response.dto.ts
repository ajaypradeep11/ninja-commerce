import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from '../../categories/dto/category-response.dto';

export class ProductResponseDto {
  id!: string;
  name!: string;
  slug!: string;
  description!: string;
  priceCents!: number;
  images!: string[];
  stockQty!: number;
  active!: boolean;
  categoryId!: string;
  createdAt!: Date;
  updatedAt!: Date;
  @ApiProperty({ type: Number, nullable: true })
  averageRating!: number | null;
  reviewCount!: number;
  @ApiProperty({ type: CategoryResponseDto, required: false })
  category?: CategoryResponseDto;
}

export class PaginatedProductsDto {
  @ApiProperty({ type: [ProductResponseDto] })
  items!: ProductResponseDto[];
  total!: number;
  page!: number;
  pageSize!: number;
}
