import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class OrderItemResponseDto {
  id!: string;
  orderId!: string;
  productId!: string;
  name!: string;
  priceCents!: number;
  quantity!: number;
}

export class OrderResponseDto {
  id!: string;
  userId!: string;
  email!: string;
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus' })
  status!: OrderStatus;
  @ApiProperty({ type: String, nullable: true })
  stripeSessionId!: string | null;
  @ApiProperty({ type: String, nullable: true })
  stripePaymentIntentId!: string | null;
  @ApiProperty({ type: Object, nullable: true })
  shippingAddress!: unknown;
  subtotalCents!: number;
  @ApiProperty({ type: Number, nullable: true })
  taxCents!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  totalCents!: number | null;
  @ApiProperty({ type: [OrderItemResponseDto] })
  items!: OrderItemResponseDto[];
  createdAt!: Date;
  updatedAt!: Date;
}

export class PaginatedOrdersDto {
  @ApiProperty({ type: [OrderResponseDto] })
  items!: OrderResponseDto[];
  total!: number;
  page!: number;
  pageSize!: number;
}

export class RefundResponseDto {
  refundId!: string;
}
