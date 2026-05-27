import { IsNotEmpty, IsString } from "class-validator";

export class CreateProductionSupplyRequestDto {
  @IsString()
  @IsNotEmpty()
  objectId: string;

  @IsString()
  @IsNotEmpty()
  purpose: string;
}
