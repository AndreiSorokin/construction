import { Type } from 'class-transformer';
import { IsArray, IsString, MinLength, ValidateNested } from 'class-validator';

export class ChainStepDto {
  @IsString() approverId: string;
  @IsString() @MinLength(1) label: string;
}

export class SetChainDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ChainStepDto) steps: ChainStepDto[];
}
