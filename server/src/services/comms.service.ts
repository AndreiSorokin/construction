import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RequestType, Role } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Связь БЕЗ сокетов: одностороннее «сотрудник → админ» — это обычный список в БД.
 * Клиент админа просто перечитывает GET /comms/messages при открытии страницы
 * (при желании — фоновым опросом раз в 60 с). Бесплатно, надёжно, без инфраструктуры.
 */
@Injectable()
export class CommsService {
  constructor(private prisma: PrismaService) {}

  // ── сообщения администратору ──
  sendToAdmin(u: AuthUser, text: string) {
    return this.prisma.adminMessage.create({ data: { organizationId: u.orgId, fromId: u.id, fromName: u.name, text } });
  }
  listAdminMessages(u: AuthUser) {
    if (u.role !== Role.ADMIN) throw new ForbiddenException('Только администратор');
    return this.prisma.adminMessage.findMany({ where: { organizationId: u.orgId }, orderBy: { createdAt: 'desc' }, take: 500 });
  }
  async markMessageRead(u: AuthUser, id: string) {
    if (u.role !== Role.ADMIN) throw new ForbiddenException('Только администратор');
    const res = await this.prisma.adminMessage.updateMany({ where: { id, organizationId: u.orgId }, data: { readAt: new Date() } });
    if (res.count === 0) throw new NotFoundException('Сообщение не найдено');
    return { ok: true };
  }

  // ── анонимка: автора НЕ пишем никуда (ни в поля, ни в логи) ──
  sendAnon(organizationId: string, text: string) {
    return this.prisma.anonMessage.create({ data: { organizationId, text }, select: { id: true, createdAt: true } });
  }
  listAnon(u: AuthUser) {
    if (u.role !== Role.ADMIN) throw new ForbiddenException('Только администратор');
    return this.prisma.anonMessage.findMany({ where: { organizationId: u.orgId }, orderBy: { createdAt: 'desc' }, take: 500 });
  }

  // ── объявления ──
  listAnnouncements(u: AuthUser) {
    return this.prisma.announcement.findMany({
      where: { organizationId: u.orgId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: { reads: { where: { userId: u.id }, select: { userId: true } } },
    }).then((rows) => rows.map(({ reads, ...a }) => ({ ...a, readByMe: reads.length > 0 })));
  }
  addAnnouncement(u: AuthUser, text: string) {
    if (u.role !== Role.ADMIN) throw new ForbiddenException('Только администратор');
    return this.prisma.announcement.create({ data: { organizationId: u.orgId, text, byId: u.id, byName: u.name } });
  }
  async deleteAnnouncement(u: AuthUser, id: string) {
    if (u.role !== Role.ADMIN) throw new ForbiddenException('Только администратор');
    const res = await this.prisma.announcement.deleteMany({ where: { id, organizationId: u.orgId } });
    if (res.count === 0) throw new NotFoundException('Объявление не найдено');
    return { ok: true };
  }
  async togglePin(u: AuthUser, id: string) {
    if (u.role !== Role.ADMIN) throw new ForbiddenException('Только администратор');
    const a = await this.prisma.announcement.findFirst({ where: { id, organizationId: u.orgId } });
    if (!a) throw new NotFoundException('Объявление не найдено');
    return this.prisma.announcement.update({ where: { id }, data: { pinned: !a.pinned } });
  }
  async markAnnouncementRead(u: AuthUser, id: string) {
    const a = await this.prisma.announcement.findFirst({ where: { id, organizationId: u.orgId } });
    if (!a) throw new NotFoundException('Объявление не найдено');
    await this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: id, userId: u.id } },
      create: { announcementId: id, userId: u.id },
      update: {},
    });
    return { ok: true };
  }

  // ── календарь ──
  listEvents(organizationId: string, from?: string, to?: string) {
    const where: Prisma.CalendarEventWhereInput = { organizationId };
    if (from || to) where.date = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    return this.prisma.calendarEvent.findMany({ where, orderBy: { date: 'asc' } });
  }
  addEvent(u: AuthUser, date: string, title: string) {
    return this.prisma.calendarEvent.create({ data: { organizationId: u.orgId, date, title, byId: u.id, byName: u.name } });
  }
  async deleteEvent(u: AuthUser, id: string) {
    const e = await this.prisma.calendarEvent.findFirst({ where: { id, organizationId: u.orgId } });
    if (!e) return { ok: true };
    if (e.byId !== u.id && u.role !== Role.ADMIN) throw new ForbiddenException('Удалить может автор или админ');
    await this.prisma.calendarEvent.delete({ where: { id } });
    return { ok: true };
  }

  // ── черновики заявок (по одному на пользователя и тип) ──
  listDrafts(u: AuthUser) {
    return this.prisma.draft.findMany({ where: { userId: u.id }, orderBy: { updatedAt: 'desc' } });
  }
  getDraft(u: AuthUser, type: RequestType) {
    return this.prisma.draft.findUnique({ where: { userId_type: { userId: u.id, type } } });
  }
  saveDraft(u: AuthUser, type: RequestType, payload: Record<string, any>) {
    return this.prisma.draft.upsert({
      where: { userId_type: { userId: u.id, type } },
      create: { userId: u.id, type, payload: payload as Prisma.InputJsonValue },
      update: { payload: payload as Prisma.InputJsonValue },
    });
  }
  async clearDraft(u: AuthUser, type: RequestType) {
    await this.prisma.draft.deleteMany({ where: { userId: u.id, type } });
    return { ok: true };
  }
}
