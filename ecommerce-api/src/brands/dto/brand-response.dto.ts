import { ApiProperty } from '@nestjs/swagger';

export class BrandResponseDto {
  id!: string;
  name!: string;
  slug!: string;
  sortOrder!: number;
  @ApiProperty({ type: String, nullable: true })
  logoUrl!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
