import { IsNotEmpty, IsString } from "class-validator";

export class CreateAppealSupplyRequestDto {
  @IsString()
  @IsNotEmpty()
<<<<<<< HEAD
  objectId!: string;

  @IsString()
  @IsNotEmpty()
  text!: string;
=======
  objectId: string;

  @IsString()
  @IsNotEmpty()
  text: string;
>>>>>>> origin/master
}
