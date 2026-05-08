import { IsArray, IsOptional, IsString } from "class-validator";

export class ReviewRequestItemsDto {
  @IsArray()
  @IsString({ each: true })
  approvedItemIds: string[];

  @IsOptional()
  @IsString()
  comment?: string;
}
