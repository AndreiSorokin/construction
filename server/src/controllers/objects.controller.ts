import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ObjectsService } from '../services/objects.service';
import { CreateObjectDto, ObjectAccessDto, UpdateObjectDto } from '../dto/dict.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('objects')
export class ObjectsController {
  constructor(private objects: ObjectsService) {}

  @Get() list() { return this.objects.list(); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Post() create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateObjectDto) { return this.objects.create(orgId, dto); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateObjectDto) { return this.objects.update(id, dto); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) { return this.objects.remove(id); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Put(':id/access') access(@Param('id') id: string, @Body() dto: ObjectAccessDto) {
    return this.objects.setAccess(id, dto.userIds);
  }
}
