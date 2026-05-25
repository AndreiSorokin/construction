import { plainToInstance, Transform, Type } from "class-transformer";
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
  @Transform(({ value }) => {
    const parsedValue =
      typeof value === "string"
        ? (() => {
            try {
              return JSON.parse(value) as unknown;
            } catch {
              return value;
            }
          })()
        : value;

    if (!Array.isArray(parsedValue)) {
      return parsedValue;
    }

    return parsedValue.map((item) =>
      plainToInstance(SetPtoLimitPriceItemDto, item),
    );
  })
  @Type(() => SetPtoLimitPriceItemDto)
  items: SetPtoLimitPriceItemDto[];
}
