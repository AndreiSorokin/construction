import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { AddObjectAccessDto } from "./dto/add-object-access.dto";
import { CreateObjectMaterialDto } from "./dto/create-object-material.dto";
import { CreateObjectDto } from "./dto/create-object.dto";
import { UpdateObjectMaterialDto } from "./dto/update-object-material.dto";
import { ObjectsService } from "./objects.service";

@Controller("objects")
export class ObjectsController {
  constructor(private readonly objectsService: ObjectsService) {}

  @Post()
  create(@Body() dto: CreateObjectDto) {
    return this.objectsService.create(dto);
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
  addAccess(@Param("id") id: string, @Body() dto: AddObjectAccessDto) {
    return this.objectsService.addAccess(id, dto);
  }

  @Post(":id/materials")
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
  updateMaterial(
    @Param("id") id: string,
    @Param("materialId") materialId: string,
    @Body() dto: UpdateObjectMaterialDto,
  ) {
    return this.objectsService.updateMaterial(id, materialId, dto);
  }
}
