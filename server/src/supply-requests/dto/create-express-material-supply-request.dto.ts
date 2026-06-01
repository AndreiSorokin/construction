import { IsNotEmpty, IsString } from "class-validator";

export class CreateExpressMaterialSupplyRequestDto {
  @IsString()
  @IsNotEmpty()
  objectId: string;

  @IsString()
  @IsNotEmpty()
  comment: string;

  @IsString()
  @IsNotEmpty()
  items: string;
}
