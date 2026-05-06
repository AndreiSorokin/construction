import { IsOptional, IsString } from "class-validator";

export class AssignSupplyRequestDto {
  @IsString()
  supplyUserId: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
