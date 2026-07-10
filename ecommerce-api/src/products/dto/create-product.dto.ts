import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' })
  slug!: string;

  @IsString()
  description!: string;

  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsArray()
  @IsUrl({ require_tld: false }, { each: true })
  images!: string[];

  @IsInt()
  @Min(0)
  stockQty!: number;

  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
