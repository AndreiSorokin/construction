import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CatalogService } from '../services/catalog.service';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from '../dto/dict.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('catalog-items')
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  @Get() list() { return this.catalog.list(); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Post() create(@Body() dto: CreateCatalogItemDto) { return this.catalog.create(dto); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateCatalogItemDto) { return this.catalog.update(id, dto); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) { return this.catalog.remove(id); }
}
