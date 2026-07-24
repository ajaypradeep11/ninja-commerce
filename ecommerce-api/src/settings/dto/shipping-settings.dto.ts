import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class ShippingSettingsDto {
  @ApiProperty()
  freeShippingThresholdCents!: number;

  @ApiProperty()
  standardShippingCents!: number;

  @ApiProperty()
  expeditedShippingCents!: number;
}

export class UpdateShippingSettingsDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  freeShippingThresholdCents!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  standardShippingCents!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  expeditedShippingCents!: number;
}
