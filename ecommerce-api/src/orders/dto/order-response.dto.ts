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
  @ApiProperty({ enum: ['CAD', 'USD'], description: 'Currency this order was charged in' })
  currency!: 'CAD' | 'USD';
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
  discountCents!: number | null;
  @ApiProperty({ type: String, nullable: true })
  couponCode!: string | null;
  @ApiProperty({ type: Number, nullable: true })
  taxCents!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  totalCents!: number | null;
  @ApiProperty({ type: [OrderItemResponseDto] })
  items!: OrderItemResponseDto[];
  @ApiProperty({ type: Date, nullable: true })
  deliveredAt!: Date | null;
  @ApiProperty({ type: Date, nullable: true })
  returnRequestedAt!: Date | null;
  @ApiProperty({ type: String, nullable: true })
  returnReason!: string | null;
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
