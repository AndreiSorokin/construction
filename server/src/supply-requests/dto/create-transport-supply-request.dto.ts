import { IsDateString, IsNotEmpty, IsString, Matches } from "class-validator";

export class CreateTransportSupplyRequestDto {
  @IsString()
  @IsNotEmpty()
  objectId: string;

  @IsString()
  @IsNotEmpty()
  transportType: string;

  @IsString()
  @IsNotEmpty()
  transportObjectName: string;

  @IsDateString()
  transportDate: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  transportTime: string;

  @IsString()
  @IsNotEmpty()
  purpose: string;
}
