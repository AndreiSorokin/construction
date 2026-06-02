import { IsNotEmpty, IsString } from "class-validator";

export class CreateFuelSupplyRequestDto {
  @IsString()
  @IsNotEmpty()
  objectId: string;

  @IsString()
  @IsNotEmpty()
  fuelType: string;

  @IsString()
  @IsNotEmpty()
  purpose: string;
}
