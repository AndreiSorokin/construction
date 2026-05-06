import { IsNumberString, IsOptional, IsString } from "class-validator";

export class UpdateSupplyRequestItemDto {
  @IsNumberString()
  quantity: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
