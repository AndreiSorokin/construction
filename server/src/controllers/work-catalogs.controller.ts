import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { WorkCatalogsService } from '../services/work-catalogs.service';
import {
  CreateWorkCatalogDto, ImportWorksDto, UpdateWorkCatalogDto, UpdateWorkItemDto, WorkItemDto,
} from '../dto/work.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('work-catalogs')
export class WorkCatalogsController {
  constructor(private works: WorkCatalogsService) {}

  @Get() list(@CurrentUser('orgId') orgId: string) { return this.works.list(orgId); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Post() create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateWorkCatalogDto) { return this.works.create(orgId, dto); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateWorkCatalogDto, @CurrentUser('orgId') orgId: string) { return this.works.update(id, orgId, dto); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser('orgId') orgId: string) { return this.works.remove(id, orgId); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Post(':id/items') addItem(@Param('id') id: string, @Body() dto: WorkItemDto, @CurrentUser('orgId') orgId: string) { return this.works.addItem(id, orgId, dto); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Patch(':id/items/:itemId') updateItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: UpdateWorkItemDto, @CurrentUser('orgId') orgId: string) {
    return this.works.updateItem(id, orgId, itemId, dto);
  }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Delete(':id/items/:itemId') removeItem(@Param('id') id: string, @Param('itemId') itemId: string, @CurrentUser('orgId') orgId: string) { return this.works.removeItem(id, orgId, itemId); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Post(':id/import') import_(@Param('id') id: string, @Body() dto: ImportWorksDto, @CurrentUser('orgId') orgId: string) { return this.works.import(id, orgId, dto); }
}
