import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

// One CSV row. Fields are optional at the DTO layer so the global ValidationPipe
// does not reject the whole batch — row-level validation (required name, category
// resolution, slug generation) happens in the service so we can report per-row
// errors and still import the valid rows. Price/stock keep type guards; the admin
// converts price → integer cents and pre-validates before sending.
export class BulkProductItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class BulkUploadProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => BulkProductItemDto)
  items!: BulkProductItemDto[];
}
