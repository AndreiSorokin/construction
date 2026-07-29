import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { WorkCatalogsService } from '../services/work-catalogs.service';
import {
  CreateWorkCatalogDto, ImportWorksDto, UpdateWorkCatalogDto, UpdateWorkItemDto, WorkItemDto,
} from '../dto/work.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('work-catalogs')
export class WorkCatalogsController {
  constructor(private works: WorkCatalogsService) {}

  @Get() list() { return this.works.list(); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Post() create(@Body() dto: CreateWorkCatalogDto) { return this.works.create(dto); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateWorkCatalogDto) { return this.works.update(id, dto); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) { return this.works.remove(id); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Post(':id/items') addItem(@Param('id') id: string, @Body() dto: WorkItemDto) { return this.works.addItem(id, dto); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Patch(':id/items/:itemId') updateItem(@Param('itemId') itemId: string, @Body() dto: UpdateWorkItemDto) {
    return this.works.updateItem(itemId, dto);
  }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Delete(':id/items/:itemId') removeItem(@Param('itemId') itemId: string) { return this.works.removeItem(itemId); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Post(':id/import') import_(@Param('id') id: string, @Body() dto: ImportWorksDto) { return this.works.import(id, dto); }
}
