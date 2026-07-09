import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

export class AddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsString()
  line1!: string;

  @IsOptional()
  @IsString()
  line2?: string;

  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsString()
  postalCode!: string;

  @IsString()
  @Length(2, 2)
  country!: string;
}

export class UpdateAddressesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  addresses!: AddressDto[];
}
