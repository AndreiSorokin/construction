import { IsBoolean, IsOptional, IsString, MinLength, IsArray } from 'class-validator';

export class NameDto {
  @IsString() @MinLength(1) name: string;
}

export class UpdateNameDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
}

export class CreateObjectDto {
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() departmentId?: string;
}

export class UpdateObjectDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() departmentId?: string | null;
}

export class ObjectAccessDto {
  @IsArray() @IsString({ each: true }) userIds: string[];
}

export class CreateCatalogItemDto {
  @IsString() @MinLength(1) name: string;
  @IsString() unit: string;
  @IsOptional() @IsString() category?: string;
}

export class UpdateCatalogItemDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() category?: string;
}

export class CreateIpDto {
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsString() bin?: string;
  @IsOptional() @IsBoolean() vat?: boolean;
}

export class UpdateIpDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() bin?: string;
  @IsOptional() @IsBoolean() vat?: boolean;
}
