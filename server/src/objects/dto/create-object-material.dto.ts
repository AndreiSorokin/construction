import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class CreateObjectMaterialDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  measurementUnit: string;

  @IsNumberString()
  estimatedPrice: string;
}
