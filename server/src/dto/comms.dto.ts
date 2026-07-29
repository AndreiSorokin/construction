import { IsObject, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class TextDto {
  @IsString() @MinLength(1) text: string;
}

export class AnonDto {
  @IsString() @MinLength(1) text: string;
}

export class EventDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string; // YYYY-MM-DD
  @IsString() @MinLength(1) title: string;
}

export class DraftDto {
  @IsOptional() @IsObject() payload?: Record<string, any>;
}
