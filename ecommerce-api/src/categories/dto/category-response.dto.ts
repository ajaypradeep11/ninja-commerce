export class CategoryResponseDto {
  id!: string;
  name!: string;
  slug!: string;
  sortOrder!: number;
  imageUrl!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
