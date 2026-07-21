import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestReturnDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
