import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumberString,
  IsString,
  ValidateNested,
} from "class-validator";

class CreateQuarrySupplyRequestItemDto {
  @IsString()
  @IsNotEmpty()
  materialName: string;

  @IsString()
  @IsNotEmpty()
  measurementUnit: string;

  @IsNumberString()
  quantity: string;
}

export class CreateQuarrySupplyRequestDto {
  @IsString()
  @IsNotEmpty()
  objectId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuarrySupplyRequestItemDto)
  items: CreateQuarrySupplyRequestItemDto[];
}
