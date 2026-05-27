import { IsOptional, IsString } from "class-validator";

export class AssignWorkshopManagerDto {
  @IsString()
  workshopManagerId: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
