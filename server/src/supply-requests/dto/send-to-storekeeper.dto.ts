import { IsOptional, IsString } from "class-validator";

export class SendToStorekeeperDto {
  @IsString()
  storekeeperUserId: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
