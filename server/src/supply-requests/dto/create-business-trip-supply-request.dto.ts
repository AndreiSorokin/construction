import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class CreateBusinessTripSupplyRequestDto {
  @IsString()
  @IsNotEmpty()
  objectId: string;

  @IsNumberString()
  amount: string;

  @IsString()
  @IsNotEmpty()
  purpose: string;
}
