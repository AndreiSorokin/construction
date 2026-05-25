import { IsNumberString, IsOptional, IsString } from "class-validator";

export class UpdateSupplyRequestItemDto {
  @IsOptional()
  @IsNumberString()
  quantity?: string;

  @IsOptional()
  @IsNumberString()
  orderQuantity?: string;

  @IsOptional()
  @IsNumberString()
  stockQuantity?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
