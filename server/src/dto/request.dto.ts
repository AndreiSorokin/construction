import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsEnum, IsIn, IsISO8601, IsOptional, IsString, MinLength, ValidateNested,
} from 'class-validator';
import { Priority, RequestType, StockStatus, SupplyStage } from '@prisma/client';

export class RequestItemDto {
  @IsString() name: string;
  @IsString() unit: string;
  @IsOptional() @IsString() qty?: string;
  @IsOptional() @IsString() note?: string;
}

export class CreateRequestDto {
  @IsEnum(RequestType) type: RequestType;
  @IsString() departmentId: string;
  @IsOptional() @IsString() objectId?: string;
  @IsOptional() @IsEnum(Priority) priority?: Priority;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsISO8601() due?: string;
  @IsOptional() fields?: Record<string, any>;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RequestItemDto) items: RequestItemDto[];
}

export class DecideDto {
  @IsIn(['approve', 'reject']) action: 'approve' | 'reject';
  @IsOptional() @IsString() comment?: string;
}

export class SetStageDto {
  @IsEnum(SupplyStage) stage: SupplyStage;
}

export class SupplyNoteDto {
  @IsString() @MinLength(1) text: string;
}

export class StockDto {
  @IsEnum(StockStatus) status: StockStatus;
}

export class FulfilledDto {
  @IsBoolean() fulfilled: boolean;
}

export class AssignDto {
  @IsString() assigneeId: string;
}

export class PostponeDto {
  @IsBoolean() postponed: boolean;
}
