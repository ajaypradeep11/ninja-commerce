import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export const DISCOUNT_TYPES = ['PERCENT', 'FIXED'] as const;
export type DiscountTypeValue = (typeof DISCOUNT_TYPES)[number];

export class CreateCouponDto {
  // Uppercase alphanumeric (dashes allowed), normalized server-side.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9-]{1,31}$/, {
    message: 'code must be 2-32 chars: letters, numbers, dashes',
  })
  code!: string;

  @ApiProperty({ enum: DISCOUNT_TYPES })
  @IsIn(DISCOUNT_TYPES)
  type!: DiscountTypeValue;

  // PERCENT: 1-100 (validated in service); FIXED: cents >= 1
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  value!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

export class CouponResponseDto {
  id!: string;
  code!: string;
  @ApiProperty({ enum: DISCOUNT_TYPES })
  type!: DiscountTypeValue;
  value!: number;
  active!: boolean;
  redemptionCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export class ValidateCouponDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  code!: string;

  @IsInt()
  @Min(0)
  subtotalCents!: number;
}

export class CouponQuoteDto {
  code!: string;
  @ApiProperty({ enum: DISCOUNT_TYPES })
  type!: DiscountTypeValue;
  value!: number;
  discountCents!: number;
}
