import { ApiProperty } from '@nestjs/swagger';

export class LowStockProductDto {
  id!: string;
  name!: string;
  slug!: string;
  stockQty!: number;
}

export class AdminStatsDto {
  ordersToday!: number;
  @ApiProperty({ type: [LowStockProductDto] })
  lowStockProducts!: LowStockProductDto[];
}
