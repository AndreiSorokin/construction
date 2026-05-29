import { IsEnum, IsString } from "class-validator";

export enum CopyObjectAccessMode {
  OVERWRITE_ROLES = "OVERWRITE_ROLES",
  SKIP_EXISTING = "SKIP_EXISTING",
}

export class CopyObjectAccessDto {
  @IsString()
  sourceObjectId: string;

  @IsEnum(CopyObjectAccessMode)
  mode: CopyObjectAccessMode;
}
