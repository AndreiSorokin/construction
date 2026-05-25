import { IsNotEmpty, IsString } from "class-validator";

export class UpdateObjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}
