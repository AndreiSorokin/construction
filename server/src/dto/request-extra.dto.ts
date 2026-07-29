import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsEnum, IsISO8601, IsNumber, IsOptional, IsString, ValidateNested,
} from 'class-validator';
import { Priority } from '@prisma/client';

export class EditItemDto {
  @IsOptional() @IsString() id?: string; // без id — новая позиция
  @IsString() name: string;
  @IsString() unit: string;
  @IsOptional() @IsString() qty?: string;
  @IsOptional() @IsString() note?: string;
}

export class EditRequestDto {
  @IsOptional() @IsString() note?: string;
  @IsOptional() due?: string | null;
  @IsOptional() objectId?: string | null;
  @IsOptional() fields?: Record<string, any>;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => EditItemDto) items?: EditItemDto[];
  @IsOptional() @IsString() comment?: string;
}

export class PriorityDto { @IsEnum(Priority) priority: Priority; }
export class DueDto { @IsOptional() @IsISO8601() due?: string | null; }
export class SpentDto { @IsOptional() @IsNumber() spent?: number | null; }

export class ItemPatchDto {
  @IsOptional() deliveredQty?: string | number | null;
  @IsOptional() eta?: string | null;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() qty?: string;
}

export class ConsolidateDto {
  @IsArray() @ArrayMinSize(2) @IsString({ each: true }) ids: string[];
}
