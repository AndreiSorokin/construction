import { Type } from 'class-transformer';
import {
  IsArray, IsEnum, IsIn, IsNumber, IsOptional, IsString, MinLength, ValidateNested,
} from 'class-validator';
import { WorkKind } from '@prisma/client';

export class CreateWorkCatalogDto {
  @IsString() @MinLength(1) name: string;
  @IsEnum(WorkKind) kind: WorkKind;
}

export class UpdateWorkCatalogDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
}

export class WorkItemDto {
  @IsString() @MinLength(1) name: string;
  @IsString() unit: string;
  @IsNumber() price: number;
}

export class UpdateWorkItemDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() price?: number;
}

export class ImportWorksDto {
  @IsIn(['replace', 'append']) mode: 'replace' | 'append';
  @IsArray() @ValidateNested({ each: true }) @Type(() => WorkItemDto) items: WorkItemDto[];
}
