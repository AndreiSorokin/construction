import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumberString,
  IsString,
  ValidateNested,
} from "class-validator";

export class CreateMaterialSupplyRequestItemDto {
  @IsString()
  @IsNotEmpty()
  materialName: string;

  @IsString()
  @IsNotEmpty()
  measurementUnit: string;

  @IsNumberString()
  quantity: string;
}

export class CreateMaterialSupplyRequestDto {
  @IsString()
  @IsNotEmpty()
  objectId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateMaterialSupplyRequestItemDto)
  items: CreateMaterialSupplyRequestItemDto[];
}
