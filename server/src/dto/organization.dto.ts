import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterOrganizationDto {
  @IsString()
  @MinLength(2)
  orgName: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsEmail()
  adminEmail: string;

  @IsString()
  @MinLength(6)
  adminPassword: string;
}
