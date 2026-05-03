import { IsNotEmpty, IsNumberString, IsOptional, IsString } from "class-validator";

export class UpdateObjectMaterialDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  type?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  measurementUnit?: string;

  @IsOptional()
  @IsNumberString()
  estimatedPrice?: string;

}
