import { ApiProperty } from '@nestjs/swagger';

export class CheckoutSessionResponseDto {
  @ApiProperty({ description: 'Stripe hosted checkout URL to redirect the customer to' })
  url!: string;

  @ApiProperty({ description: 'Local order id created in PENDING state' })
  orderId!: string;
}
