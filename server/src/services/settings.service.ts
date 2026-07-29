import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { FilesService } from './files.service';
import { AuthUser } from '../decorators/current-user.decorator';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService, private files: FilesService) {}

  private ensure() {
    return this.prisma.appSetting.upsert({ where: { id: 'app' }, create: { id: 'app' }, update: {} });
  }

  async get() {
    const s = await this.ensure();
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const urgentToday = await this.prisma.request.count({ where: { priority: 'URGENT', createdAt: { gte: from } } });
    return {
      urgentLimit: s.urgentLimit,
      urgentToday,
      logoW: s.logoW, logoH: s.logoH,
      logoUrl: s.logoKey ? await this.files.signedGetUrl(s.logoKey) : null,
    };
  }

  async setUrgentLimit(u: AuthUser, n: number) {
    if (u.role !== Role.ADMIN) throw new ForbiddenException('Только администратор');
    const v = Math.max(0, Math.min(99, Math.round(Number(n) || 0)));
    await this.ensure();
    await this.prisma.appSetting.update({ where: { id: 'app' }, data: { urgentLimit: v } });
    return { urgentLimit: v };
  }

  // логотип: принимаем PNG (с альфой) / SVG / JPG как есть — рендер по пропорциям делает клиент
  async setLogo(u: AuthUser, file: Express.Multer.File, w?: number, h?: number) {
    if (u.role !== Role.ADMIN) throw new ForbiddenException('Только администратор');
    const prev = await this.ensure();
    const saved = await this.files.upload(file);
    await this.prisma.appSetting.update({
      where: { id: 'app' },
      data: { logoKey: saved.key, logoW: w ?? null, logoH: h ?? null },
    });
    if (prev.logoKey) await this.files.remove(prev.logoKey).catch(() => undefined);
    return this.get();
  }

  async clearLogo(u: AuthUser) {
    if (u.role !== Role.ADMIN) throw new ForbiddenException('Только администратор');
    const prev = await this.ensure();
    await this.prisma.appSetting.update({ where: { id: 'app' }, data: { logoKey: null, logoW: null, logoH: null } });
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
