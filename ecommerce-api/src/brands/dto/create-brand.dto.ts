import { IsInt, IsOptional, IsString, Matches } from 'class-validator';

export class CreateBrandDto {
  @IsString()
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' })
  slug!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
