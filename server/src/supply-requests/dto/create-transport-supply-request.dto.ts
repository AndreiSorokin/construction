import { IsNotEmpty, IsString } from "class-validator";

export class CreateTransportSupplyRequestDto {
  @IsString()
  @IsNotEmpty()
  objectId: string;

  @IsString()
  @IsNotEmpty()
  transportType: string;

  @IsString()
  @IsNotEmpty()
  purpose: string;
}
