import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class OrderCancelResponseDto {
  @ApiProperty({
    enum: OrderStatus,
    description:
      'Status after cancelling. CANCELLED for an unpaid order; PAID for a paid order whose refund is in flight (flips to REFUNDED via webhook).',
  })
  status!: OrderStatus;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'Stripe refund id when a paid order was refunded',
  })
  refundId?: string;
}
