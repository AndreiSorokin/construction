import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { FilesService } from './files.service';
import { AuthUser } from '../decorators/current-user.decorator';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService, private files: FilesService) {}

  private ensure(organizationId: string) {
    return this.prisma.appSetting.upsert({ where: { organizationId }, create: { organizationId }, update: {} });
  }

  async get(organizationId: string) {
    const s = await this.ensure(organizationId);
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const urgentToday = await this.prisma.request.count({ where: { organizationId, priority: 'URGENT', createdAt: { gte: from } } });
    return {
      urgentLimit: s.urgentLimit,
      urgentToday,
      logoW: s.logoW, logoH: s.logoH,
      // отдаём через свой домен, а не подписанную ссылку на S3 (та ещё и истекает через 5 минут —
      // логотип в шапке успевал бы перестать грузиться); ?v= меняется при каждой загрузке — не кешируем старую версию
      logoUrl: s.logoKey ? `/api/settings/logo/file?v=${encodeURIComponent(s.logoKey)}` : null,
    };
  }

  /** объект логотипа в S3 для проксирующего эндпоинта (публичный, нужен на странице входа) */
  async getLogoObject(organizationId: string) {
    const s = await this.ensure(organizationId);
    if (!s.logoKey) return null;
    return { key: s.logoKey, object: await this.files.getObject(s.logoKey) };
  }

  async setUrgentLimit(u: AuthUser, n: number) {
    if (u.role !== Role.ADMIN) throw new ForbiddenException('Только администратор');
    const v = Math.max(0, Math.min(99, Math.round(Number(n) || 0)));
    await this.ensure(u.orgId);
    await this.prisma.appSetting.update({ where: { organizationId: u.orgId }, data: { urgentLimit: v } });
    return { urgentLimit: v };
  }

  // логотип: принимаем PNG (с альфой) / SVG / JPG как есть — рендер по пропорциям делает клиент
  async setLogo(u: AuthUser, file: Express.Multer.File, w?: number, h?: number) {
    if (u.role !== Role.ADMIN) throw new ForbiddenException('Только администратор');
    const prev = await this.ensure(u.orgId);
    const saved = await this.files.upload(file);
    await this.prisma.appSetting.update({
      where: { organizationId: u.orgId },
      data: { logoKey: saved.key, logoW: w ?? null, logoH: h ?? null },
    });
    if (prev.logoKey) await this.files.remove(prev.logoKey).catch(() => undefined);
    return this.get(u.orgId);
  }

  async clearLogo(u: AuthUser) {
    if (u.role !== Role.ADMIN) throw new ForbiddenException('Только администратор');
    const prev = await this.ensure(u.orgId);
    await this.prisma.appSetting.update({ where: { organizationId: u.orgId }, data: { logoKey: null, logoW: null, logoH: null } });
    if (prev.logoKey) await this.files.remove(prev.logoKey).catch(() => undefined);
    return { ok: true };
  }

  // профиль: тема и аватар текущего пользователя
  async setTheme(u: AuthUser, theme: string) {
    const t = theme === 'dark' ? 'dark' : 'light';
    await this.prisma.user.update({ where: { id: u.id }, data: { theme: t } });
    return { theme: t };
  }

  async setAvatar(u: AuthUser, file: Express.Multer.File) {
    const me = await this.prisma.user.findUnique({ where: { id: u.id } });
    const saved = await this.files.upload(file);
    await this.prisma.user.update({ where: { id: u.id }, data: { avatarKey: saved.key } });
    if (me?.avatarKey) await this.files.remove(me.avatarKey).catch(() => undefined);
    return { avatarUrl: await this.files.signedGetUrl(saved.key) };
  }

  async avatarUrl(userId: string) {
    const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarKey: true } });
    return { avatarUrl: me?.avatarKey ? await this.files.signedGetUrl(me.avatarKey) : null };
  }
}
