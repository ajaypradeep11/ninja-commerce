import { ApiProperty } from '@nestjs/swagger';
import { AddressDto } from './update-addresses.dto';

export class UserResponseDto {
  @ApiProperty({ description: 'Firebase UID' }) id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: ['CUSTOMER', 'ADMIN'] }) role!: string;
  @ApiProperty({ type: [AddressDto] }) addresses!: AddressDto[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
