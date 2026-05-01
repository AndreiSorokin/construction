import { ObjectType } from "@prisma/client";

export class CreateObjectDto {
  name: string;
  type: ObjectType;
  closingLimit: string | number;
  ownerId: string;
}
