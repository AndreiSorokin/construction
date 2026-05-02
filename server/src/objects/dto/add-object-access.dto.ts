import { UserObjectRole } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class AddObjectAccessDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsEnum(UserObjectRole)
  role?: UserObjectRole;
}
