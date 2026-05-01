import { UserRole } from "@prisma/client";

export class CreateUserDto {
  name: string;
  role: UserRole;
}
