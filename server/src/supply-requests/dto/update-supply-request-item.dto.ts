import { IsNumberString, IsOptional, IsString } from "class-validator";

export class UpdateSupplyRequestItemDto {
  @IsOptional()
  @IsNumberString()
  quantity?: string;

  @IsOptional()
  @IsNumberString()
  orderQuantity?: string;

  @IsOptional()
  @IsNumberString()
  stockQuantity?: string;

  @IsOptional()
  @IsNumberString()
  cashPaidAmount?: string;

  @IsOptional()
  @IsString()
  cashPaymentComment?: string;

  @IsOptional()
  @IsString()
  ptoComment?: string;

  @IsOptional()
  @IsString()
  chiefEngineerComment?: string;

  @IsOptional()
  @IsString()
  supplyManagerComment?: string;

  @IsOptional()
  @IsString()
  supplierComment?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
