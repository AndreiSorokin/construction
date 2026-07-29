import { IsNumber, IsOptional, IsString } from 'class-validator';

export class LinePatchDto {
  @IsOptional() @IsString() qty?: string;
  @IsOptional() @IsNumber() price?: number;
}
