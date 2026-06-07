import { ObjectDirection, ObjectType } from "@prisma/client";
import {
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  ValidateIf,
} from "class-validator";

export class CreateObjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ObjectType)
  type: ObjectType;

  @IsOptional()
  @IsEnum(ObjectDirection)
  direction?: ObjectDirection;

  @ValidateIf((dto: CreateObjectDto) => dto.type === ObjectType.CONSTRUCTION_OBJECT)
  @IsOptional()
  @IsNumberString()
  materialsLimit?: string;

  @ValidateIf((dto: CreateObjectDto) => dto.type === ObjectType.CONSTRUCTION_OBJECT)
  @IsOptional()
  @IsNumberString()
  transportLimit?: string;

  @ValidateIf((dto: CreateObjectDto) => dto.type === ObjectType.CONSTRUCTION_OBJECT)
  @IsOptional()
  @IsNumberString()
  moneyLimit?: string;
}
