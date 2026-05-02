import { ObjectType } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class CreateObjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ObjectType)
  type: ObjectType;

  @IsNumberString()
  closingLimit: string;
}
