import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from '../../categories/dto/category-response.dto';
import { BrandResponseDto } from '../../brands/dto/brand-response.dto';

export class ProductBaseResponseDto {
  id!: string;
  name!: string;
  slug!: string;
  description!: string;
  priceCents!: number;
  @ApiProperty({ description: 'USD price in cents', example: 3999 })
  priceUsdCents!: number;
  images!: string[];
  stockQty!: number;
  active!: boolean;
  categoryId!: string;
  @ApiProperty({ type: String, nullable: true })
  brandId!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class ProductResponseDto extends ProductBaseResponseDto {
  @ApiProperty({ type: Number, nullable: true })
  averageRating!: number | null;
  reviewCount!: number;
  @ApiProperty({ type: CategoryResponseDto, required: false })
  category?: CategoryResponseDto;
  @ApiProperty({ type: BrandResponseDto, required: false, nullable: true })
  brand?: BrandResponseDto | null;
}

export class PaginatedProductsDto {
  @ApiProperty({ type: [ProductResponseDto] })
  items!: ProductResponseDto[];
  total!: number;
  page!: number;
  pageSize!: number;
}
