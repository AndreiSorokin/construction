import { IsArray, IsOptional, IsString } from "class-validator";

export class CompleteStorekeeperRequestDto {
  @IsArray()
  @IsString({ each: true })
  completedItemIds: string[];

  @IsOptional()
  @IsString()
  comment?: string;
}
