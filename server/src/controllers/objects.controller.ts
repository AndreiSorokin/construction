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

  @Get() list(@CurrentUser('orgId') orgId: string) { return this.objects.list(orgId); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Post() create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateObjectDto) { return this.objects.create(orgId, dto); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateObjectDto, @CurrentUser('orgId') orgId: string) { return this.objects.update(id, orgId, dto); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser('orgId') orgId: string) { return this.objects.remove(id, orgId); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Put(':id/access') access(@Param('id') id: string, @Body() dto: ObjectAccessDto, @CurrentUser('orgId') orgId: string) {
    return this.objects.setAccess(id, orgId, dto.userIds);
  }
}
