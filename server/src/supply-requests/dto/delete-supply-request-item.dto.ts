import { IsOptional, IsString } from "class-validator";

export class DeleteSupplyRequestItemDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
