import { IsNotEmpty, IsString } from "class-validator";

export class CreateAppealSupplyRequestDto {
  @IsString()
  @IsNotEmpty()
  objectId!: string;

  @IsString()
  @IsNotEmpty()
  text!: string;
}
