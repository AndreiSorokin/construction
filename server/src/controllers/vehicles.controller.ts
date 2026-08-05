import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { VehiclesService } from '../services/vehicles.service';
import { NameDto } from '../dto/dict.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('vehicles')
export class VehiclesController {
  constructor(private vehicles: VehiclesService) {}

  @Get() list() { return this.vehicles.list(); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Post() create(@Body() dto: NameDto) { return this.vehicles.create(dto.name); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Patch(':id') update(@Param('id') id: string, @Body() dto: NameDto) { return this.vehicles.update(id, dto.name); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) { return this.vehicles.remove(id); }
}
