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

export class SetSupplierPurchasePriceItemDto {
  @IsString()
  @IsNotEmpty()
  requestItemId: string;

  @IsNumberString()
  supplierPurchasePrice: string;
}

export class SetSupplierPurchasePricesDto {
  @IsOptional()
  @IsString()
  comment?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SetSupplierPurchasePriceItemDto)
  items: SetSupplierPurchasePriceItemDto[];
}
