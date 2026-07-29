import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { DepartmentsService } from '../services/departments.service';
import { NameDto } from '../dto/dict.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('departments')
export class DepartmentsController {
  constructor(private departments: DepartmentsService) {}

  @Get() list() { return this.departments.list(); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Post() create(@Body() dto: NameDto) { return this.departments.create(dto.name); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Patch(':id') update(@Param('id') id: string, @Body() dto: NameDto) { return this.departments.update(id, dto.name); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) { return this.departments.remove(id); }
}
