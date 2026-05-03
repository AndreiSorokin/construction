import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class CreateMoneySupplyRequestDto {
  @IsString()
  @IsNotEmpty()
  objectId: string;

  @IsNumberString()
  amount: string;

  @IsString()
  @IsNotEmpty()
  paymentPurpose: string;
}
