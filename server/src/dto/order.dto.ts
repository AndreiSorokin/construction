import { Type } from 'class-transformer';
import {
  IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, ArrayMinSize, MinLength, ValidateNested,
} from 'class-validator';

export class OrderLineDto {
  @IsOptional() @IsString() workId?: string;
  @IsString() @MinLength(1) name: string;
  @IsString() unit: string;
  @IsNumber() price: number;
  @IsOptional() @IsInt() dsu?: number | null;
  @IsString() qty: string;
}

export class CreateOrderDto {
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() objectId?: string;
  @IsOptional() @IsString() ipId?: string;
  @Matches(/^\d{4}-\d{2}$/, { message: 'period: формат YYYY-MM' }) period: string;
  @IsOptional() @IsString() catalogId?: string;
  @IsOptional() @IsString() note?: string;
  @IsArray() @ArrayMinSize(1, { message: 'В наряде нет ни одной позиции — добавьте работы' }) @ValidateNested({ each: true }) @Type(() => OrderLineDto) lines: OrderLineDto[];
}

export class OrderDecideDto {
  @IsIn(['approve', 'reject']) action: 'approve' | 'reject';
  @IsOptional() @IsString() comment?: string;
}
