import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Min,
  ValidateIf,
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

  // Optional franchise tag; explicit null clears the brand on update.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  brandId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
