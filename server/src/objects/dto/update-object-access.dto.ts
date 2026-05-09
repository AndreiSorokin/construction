import { IsEnum } from "class-validator";
import { UserRole } from "@prisma/client";

export class UpdateObjectAccessDto {
  @IsEnum(UserRole)
  role: UserRole;
}
