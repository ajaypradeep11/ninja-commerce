import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListProductsQuery {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  pageSize: number = 12;

  @IsOptional()
  @IsIn(['newest', 'price_asc', 'price_desc'])
  sort?: 'newest' | 'price_asc' | 'price_desc';

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  all?: boolean;
}
