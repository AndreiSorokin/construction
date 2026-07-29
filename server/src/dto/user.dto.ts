import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsOptional() @IsString() login?: string;
  @IsString() @MinLength(4) password: string;
  @IsString() name: string;
  @IsEnum(Role) role: Role;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsBoolean() ordersAccess?: boolean;
  @IsOptional() @IsBoolean() canPrice?: boolean;
  @IsOptional() @IsBoolean() isLead?: boolean;
  @IsOptional() @IsEmail() email?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() login?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsString() departmentId?: string | null;
  @IsOptional() @IsBoolean() ordersAccess?: boolean;
  @IsOptional() @IsBoolean() isLead?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsEmail() email?: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(4) newPassword: string;
}
