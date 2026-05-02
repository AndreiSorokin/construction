import { UserObjectRole, UserRole } from "@prisma/client";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(UserRole)
  userRole: UserRole;

  @IsOptional()
  @IsEnum(UserObjectRole)
  objectRole?: UserObjectRole;
}
