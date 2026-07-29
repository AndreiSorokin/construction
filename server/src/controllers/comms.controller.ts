import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CommsService } from '../services/comms.service';
import { CurrentUser, AuthUser } from '../decorators/current-user.decorator';
import { AnonDto, DraftDto, EventDto, TextDto } from '../dto/comms.dto';
import { RequestType } from '@prisma/client';

@Controller('comms')
export class CommsController {
  constructor(private comms: CommsService) {}

  // сообщения администратору (односторонний список, без сокетов)
  @Post('messages')
  send(@Body() dto: TextDto, @CurrentUser() u: AuthUser) { return this.comms.sendToAdmin(u, dto.text); }
  @Get('messages')
  listMessages(@CurrentUser() u: AuthUser) { return this.comms.listAdminMessages(u); }
  @Patch('messages/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.comms.markMessageRead(u, id); }

  // анонимка руководству — автор не сохраняется
  @Post('anon')
  anon(@Body() dto: AnonDto) { return this.comms.sendAnon(dto.text); }
  @Get('anon')
  listAnon(@CurrentUser() u: AuthUser) { return this.comms.listAnon(u); }

  // объявления
  @Get('announcements')
  ann(@CurrentUser() u: AuthUser) { return this.comms.listAnnouncements(u); }
  @Post('announcements')
  addAnn(@Body() dto: TextDto, @CurrentUser() u: AuthUser) { return this.comms.addAnnouncement(u, dto.text); }
  @Delete('announcements/:id')
  delAnn(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.comms.deleteAnnouncement(u, id); }
  @Patch('announcements/:id/pin')
  pin(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.comms.togglePin(u, id); }
  @Post('announcements/:id/read')
  annRead(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.comms.markAnnouncementRead(u, id); }

  // календарь
  @Get('events')
  events(@Query('from') from?: string, @Query('to') to?: string) { return this.comms.listEvents(from, to); }
  @Post('events')
  addEvent(@Body() dto: EventDto, @CurrentUser() u: AuthUser) { return this.comms.addEvent(u, dto.date, dto.title); }
  @Delete('events/:id')
  delEvent(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.comms.deleteEvent(u, id); }

  // черновики
  @Get('drafts/:type')
  getDraft(@Param('type') type: RequestType, @CurrentUser() u: AuthUser) { return this.comms.getDraft(u, type); }
  @Post('drafts/:type')
  saveDraft(@Param('type') type: RequestType, @Body() dto: DraftDto, @CurrentUser() u: AuthUser) {
    return this.comms.saveDraft(u, type, dto.payload || {});
  }
  @Delete('drafts/:type')
  clearDraft(@Param('type') type: RequestType, @CurrentUser() u: AuthUser) { return this.comms.clearDraft(u, type); }
}
