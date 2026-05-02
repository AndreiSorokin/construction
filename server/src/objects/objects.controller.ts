import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
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
  @Roles(UserRole.DIRECTOR, UserRole.PTO)
  createMaterial(
    @Param("id") id: string,
    @Body() dto: CreateObjectMaterialDto,
  ) {
    return this.objectsService.createMaterial(id, dto);
  }

  @Get(":id/materials")
  findMaterials(@Param("id") id: string) {
    return this.objectsService.findMaterials(id);
  }

  @Patch(":id/materials/:materialId")
  @Roles(UserRole.DIRECTOR, UserRole.PTO)
  updateMaterial(
    @Param("id") id: string,
    @Param("materialId") materialId: string,
    @Body() dto: UpdateObjectMaterialDto,
  ) {
    return this.objectsService.updateMaterial(id, materialId, dto);
  }
}
