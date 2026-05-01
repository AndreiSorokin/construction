import { UserObjectRole } from "@prisma/client";

export class AddObjectAccessDto {
  userId: string;
  role?: UserObjectRole;
}
