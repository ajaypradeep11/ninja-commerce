import { ApiProperty } from '@nestjs/swagger';

export class BulkRowError {
  @ApiProperty({ description: '1-based index of the failed row' })
  row!: number;
  @ApiProperty()
  message!: string;
}

export class BulkUploadResponseDto {
  @ApiProperty({ description: 'Number of products created' })
  created!: number;
  @ApiProperty({ type: [BulkRowError], description: 'Rows that were skipped' })
  errors!: BulkRowError[];
}
