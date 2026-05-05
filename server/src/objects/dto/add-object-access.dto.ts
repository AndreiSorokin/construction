import { UserRole } from "@prisma/client";
import { IsEnum, IsString } from "class-validator";

export class AddObjectAccessDto {
  @IsString()
  userId: string;

  @IsEnum(UserRole)
  role: UserRole;
}
