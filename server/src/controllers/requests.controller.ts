import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RequestsService } from '../services/requests.service';
import {
  AssignDto, CreateRequestDto, DecideDto, FulfilledDto, PostponeDto, SetStageDto, StockDto, SupplyNoteDto,
} from '../dto/request.dto';
import { CurrentUser, AuthUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { Role, RequestStatus, RequestType } from '@prisma/client';

@Controller('requests')
export class RequestsController {
  constructor(private requests: RequestsService) {}

  @Get()
  list(
    @CurrentUser() u: AuthUser,
    @Query('status') status?: RequestStatus,
    @Query('type') type?: RequestType,
  ) {
    return this.requests.list(u, { status, type });
  }

  @Get(':id')
  get(@Param('id') id: string) { return this.requests.getOne(id); }

  @UseGuards(RolesGuard)
  @Roles(Role.REQUESTER, Role.APPROVER, Role.ADMIN)
  @Post()
  create(@Body() dto: CreateRequestDto, @CurrentUser() u: AuthUser) {
    return this.requests.create(dto, u);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.APPROVER, Role.WAREHOUSE, Role.ADMIN)
  @Post(':id/decide')
  decide(@Param('id') id: string, @Body() dto: DecideDto, @CurrentUser() u: AuthUser) {
    return this.requests.decide(id, u, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SUPPLY, Role.ADMIN)
  @Post(':id/claim')
  claim(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.requests.claim(id, u);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SUPPLY, Role.ADMIN)
  @Patch(':id/supply-stage')
  stage(@Param('id') id: string, @Body() dto: SetStageDto) {
    return this.requests.setSupplyStage(id, dto.stage);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SUPPLY, Role.ADMIN)
  @Post(':id/fulfill')
  fulfill(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.requests.fulfill(id, u);
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.requests.confirm(id, u);
  }

  @Post(':id/return')
  return_(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.requests.returnToSupply(id, u);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SUPPLY, Role.ADMIN)
  @Post(':id/supply-notes')
  supplyNote(@Param('id') id: string, @Body() dto: SupplyNoteDto, @CurrentUser() u: AuthUser) {
    return this.requests.addSupplyNote(id, u, dto.text);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.WAREHOUSE, Role.ADMIN)
  @Patch(':id/items/:itemId/stock')
  stock(@Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: StockDto, @CurrentUser() u: AuthUser) {
    return this.requests.setItemStock(id, itemId, u, dto.status);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SUPPLY, Role.ADMIN)
  @Patch(':id/items/:itemId/fulfilled')
  fulfilled(@Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: FulfilledDto) {
    return this.requests.setItemFulfilled(id, itemId, dto.fulfilled);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SUPPLY, Role.ADMIN)
  @Patch(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignDto, @CurrentUser() u: AuthUser) {
    return this.requests.assign(id, u, dto.assigneeId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SUPPLY, Role.ADMIN)
  @Patch(':id/postpone')
  postpone(@Param('id') id: string, @Body() dto: PostponeDto) {
    return this.requests.setPostponed(id, dto.postponed);
  }
}
