import { ObjectType } from "@prisma/client";
import {
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsString,
  ValidateIf,
} from "class-validator";

export class CreateObjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ObjectType)
  type: ObjectType;

  @ValidateIf((dto: CreateObjectDto) => dto.type === ObjectType.CONSTRUCTION_OBJECT)
  @IsNumberString()
  materialsLimit?: string;

  @ValidateIf((dto: CreateObjectDto) => dto.type === ObjectType.CONSTRUCTION_OBJECT)
  @IsNumberString()
  transportLimit?: string;

  @ValidateIf((dto: CreateObjectDto) => dto.type === ObjectType.CONSTRUCTION_OBJECT)
  @IsNumberString()
  moneyLimit?: string;
}
