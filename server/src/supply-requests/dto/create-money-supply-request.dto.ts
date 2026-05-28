import { MoneyRequestPaymentType } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class CreateMoneySupplyRequestDto {
  @IsString()
  @IsNotEmpty()
  objectId: string;

  @IsNumberString()
  amount: string;

  @IsEnum(MoneyRequestPaymentType)
  paymentType: MoneyRequestPaymentType;

  @IsString()
  @IsNotEmpty()
  paymentPurpose: string;
}
