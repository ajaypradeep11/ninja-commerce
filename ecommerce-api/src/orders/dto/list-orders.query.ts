import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class ListOrdersQuery {
  @IsOptional()
  @IsIn(Object.values(OrderStatus))
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
