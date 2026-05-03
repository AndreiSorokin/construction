import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserRole } from "@prisma/client";
import { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthenticatedUser } from "../auth/types/authenticated-user";
import { AddObjectAccessDto } from "./dto/add-object-access.dto";
import { CreateObjectMaterialDto } from "./dto/create-object-material.dto";
import { CreateObjectDto } from "./dto/create-object.dto";
import { InviteUserDto } from "./dto/invite-user.dto";
import { UpdateObjectMaterialDto } from "./dto/update-object-material.dto";
import { ObjectsService } from "./objects.service";

@Controller("objects")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ObjectsController {
  constructor(private readonly objectsService: ObjectsService) {}

  @Post()
  create(@Body() dto: CreateObjectDto, @CurrentUser() user: AuthenticatedUser) {
    return this.objectsService.create(dto, user.id);
  }

  @Get()
  findAll() {
    return this.objectsService.findAll();
  }

  @Get("materials/template")
  @Roles(UserRole.DIRECTOR, UserRole.CHIEF_ENGINEER)
  downloadMaterialsTemplate(@Res({ passthrough: true }) response: Response) {
    response.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="materials-template.xlsx"',
    });

    return new StreamableFile(this.objectsService.createMaterialsTemplate());
  }

  @Get("access/mine")
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.objectsService.findMine(user.id);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.objectsService.findOne(id);
  }

  @Post(":id/access")
  @Roles(UserRole.DIRECTOR)
  addAccess(@Param("id") id: string, @Body() dto: AddObjectAccessDto) {
    return this.objectsService.addAccess(id, dto);
  }

  @Post(":id/invitations")
  @Roles(UserRole.DIRECTOR)
  inviteUser(
    @Param("id") id: string,
    @Body() dto: InviteUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.objectsService.inviteUser(id, dto, user.id);
  }

  @Post(":id/materials")
  @Roles(UserRole.DIRECTOR, UserRole.CHIEF_ENGINEER)
  createMaterial(
    @Param("id") id: string,
    @Body() dto: CreateObjectMaterialDto,
  ) {
    return this.objectsService.createMaterial(id, dto);
  }

  @Post(":id/materials/import")
  @Roles(UserRole.DIRECTOR, UserRole.CHIEF_ENGINEER)
  @UseInterceptors(FileInterceptor("file"))
  importMaterials(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.objectsService.importMaterials(id, file);
  }

  @Get(":id/materials")
  findMaterials(@Param("id") id: string) {
    return this.objectsService.findMaterials(id);
  }

  @Patch(":id/materials/:materialId")
  @Roles(UserRole.DIRECTOR)
  updateMaterial(
    @Param("id") id: string,
    @Param("materialId") materialId: string,
    @Body() dto: UpdateObjectMaterialDto,
  ) {
    return this.objectsService.updateMaterial(id, materialId, dto);
  }

  @Delete(":id/materials/:materialId")
  @Roles(UserRole.DIRECTOR)
  deleteMaterial(
    @Param("id") id: string,
    @Param("materialId") materialId: string,
  ) {
    return this.objectsService.deleteMaterial(id, materialId);
  }

  @Delete(":id")
  @Roles(UserRole.DIRECTOR)
  delete(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.objectsService.delete(id, user.id);
  }
}
