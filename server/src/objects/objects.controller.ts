import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { AuthenticatedUser } from "../auth/types/authenticated-user";
import { AddObjectAccessDto } from "./dto/add-object-access.dto";
import { CopyObjectAccessDto } from "./dto/copy-object-access.dto";
import { CreateObjectMaterialDto } from "./dto/create-object-material.dto";
import { CreateObjectDto } from "./dto/create-object.dto";
import { InviteUserDto } from "./dto/invite-user.dto";
import { UpdateObjectAccessDto } from "./dto/update-object-access.dto";
import { UpdateObjectDto } from "./dto/update-object.dto";
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

  @Get("access/mine")
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.objectsService.findMine(user.id);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.objectsService.findOne(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateObjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.objectsService.update(id, dto, user.id);
  }

  @Post(":id/access")
  addAccess(
    @Param("id") id: string,
    @Body() dto: AddObjectAccessDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.objectsService.addAccess(id, dto, user.id);
  }

  @Post(":id/access/copy")
  copyAccesses(
    @Param("id") id: string,
    @Body() dto: CopyObjectAccessDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.objectsService.copyAccesses(id, dto, user.id);
  }

  @Patch(":id/access/:userId")
  updateAccessRole(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @Body() dto: UpdateObjectAccessDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.objectsService.updateAccessRole(
      id,
      userId,
      dto.role,
      user.id,
    );
  }

  @Delete(":id/access/:userId")
  deleteAccess(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.objectsService.deleteAccess(id, userId, user.id);
  }

  @Post(":id/invitations")
  inviteUser(
    @Param("id") id: string,
    @Body() dto: InviteUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.objectsService.inviteUser(id, dto, user.id);
  }

  @Post(":id/materials")
  createMaterial(
    @Param("id") id: string,
    @Body() dto: CreateObjectMaterialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.objectsService.createMaterial(id, dto, user.id);
  }

  @Get(":id/materials")
  findMaterials(@Param("id") id: string) {
    return this.objectsService.findMaterials(id);
  }

  @Patch(":id/materials/:materialId")
  updateMaterial(
    @Param("id") id: string,
    @Param("materialId") materialId: string,
    @Body() dto: UpdateObjectMaterialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.objectsService.updateMaterial(id, materialId, dto, user.id);
  }

  @Delete(":id/materials/:materialId")
  deleteMaterial(
    @Param("id") id: string,
    @Param("materialId") materialId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.objectsService.deleteMaterial(id, materialId, user.id);
  }

  @Delete(":id")
  delete(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.objectsService.delete(id, user.id);
  }
}
