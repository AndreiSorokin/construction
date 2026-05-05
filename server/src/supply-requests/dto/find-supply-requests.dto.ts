import { SupplyRequestStatus, SupplyRequestType } from "@prisma/client";
import { IsEnum, IsISO8601, IsOptional, IsString } from "class-validator";

export class FindSupplyRequestsDto {
  @IsOptional()
  @IsString()
  objectSearch?: string;

  @IsOptional()
  @IsEnum(SupplyRequestType)
  type?: SupplyRequestType;

  @IsOptional()
  @IsEnum(SupplyRequestStatus)
  status?: SupplyRequestStatus;

  @IsOptional()
  @IsISO8601({ strict: false })
  dateFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: false })
  dateTo?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
