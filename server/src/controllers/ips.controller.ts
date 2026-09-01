import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IpsService } from '../services/ips.service';
import { CreateIpDto, UpdateIpDto } from '../dto/dict.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('ips')
export class IpsController {
  constructor(private ips: IpsService) {}

  @Get() list() { return this.ips.list(); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Post() create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateIpDto) { return this.ips.create(orgId, dto); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateIpDto) { return this.ips.update(id, dto); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Delete(':id') remove(@Param('id') id: string) { return this.ips.remove(id); }
}
