import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

export class SetPtoLimitPriceItemDto {
  @IsString()
  @IsNotEmpty()
  requestItemId: string;

  @IsNumberString()
  ptoLimitPrice: string;
}

export class SetPtoLimitPricesDto {
  @IsOptional()
  @IsString()
  comment?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SetPtoLimitPriceItemDto)
  items: SetPtoLimitPriceItemDto[];
}
