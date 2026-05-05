import { UserRole } from "@prisma/client";
import { IsEmail, IsEnum, IsString, MinLength } from "class-validator";

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(UserRole)
  userRole: UserRole;
}
