import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { FilesService } from '../services/files.service';
import { PrismaService } from '../services/prisma.service';
import { CurrentUser, AuthUser } from '../decorators/current-user.decorator';

@Controller('files')
export class FilesController {
  constructor(private files: FilesService, private prisma: PrismaService) {}

  // загрузка вложения к заявке (multer держит файл в памяти → отправляем в S3; лимит размера не нужен — хранилище S3)
  @Post('request/:requestId')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async upload(
    @Param('requestId') requestId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() u: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Файл не передан');
    const exists = await this.prisma.request.findUnique({ where: { id: requestId }, select: { id: true } });
    if (!exists) throw new BadRequestException('Заявка не найдена');
    const saved = await this.files.upload(file);
    const att = await this.prisma.attachment.create({
      data: {
        requestId,
        key: saved.key,
        filename: saved.filename,
        mime: saved.mime,
        size: saved.size,
        byId: u.id,
        byName: u.name,
      },
    });
    return { id: att.id, filename: att.filename, mime: att.mime, size: att.size };
  }

  // загрузка вложения к НАРЯДУ (после v59 наряды тоже имеют файлы)
  @Post('order/:orderId')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadToOrder(
    @Param('orderId') orderId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() u: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Файл не передан');
    const exists = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!exists) throw new BadRequestException('Наряд не найден');
    const saved = await this.files.upload(file);
    const att = await this.prisma.attachment.create({
      data: { orderId, key: saved.key, filename: saved.filename, mime: saved.mime, size: saved.size, byId: u.id, byName: u.name },
    });
    return { id: att.id, filename: att.filename, mime: att.mime, size: att.size };
  }

  @Get(':id/url')
  async url(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    const att = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        request: { include: { chainSteps: true } },
        order: { include: { chainSteps: true } },
      },
    });
    if (!att) throw new BadRequestException('Нет вложения');
    await this.assertReadAccess(att, u);
    return { url: await this.files.signedGetUrl(att.key) };
  }

  // отдаёт файл через собственный домен (а не прямую подписанную ссылку на S3-бакет):
  // некоторые антивирусы (напр. AVG) помечают длинные подписанные S3-URL как подозрительные
  @Get(':id/download')
  async download(@Param('id') id: string, @CurrentUser() u: AuthUser, @Res() res: Response) {
    const att = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        request: { include: { chainSteps: true } },
        order: { include: { chainSteps: true } },
      },
    });
    if (!att) throw new BadRequestException('Нет вложения');
    await this.assertReadAccess(att, u);
    const obj = await this.files.getObject(att.key);
    res.set('Content-Type', att.mime || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${encodeURIComponent(att.filename)}"`);
    if (obj.ContentLength) res.set('Content-Length', String(obj.ContentLength));
    (obj.Body as NodeJS.ReadableStream).pipe(res);
  }

  // доступ к файлу — тем, кто вообще видит документ: автор, согласующие в его цепочке,
  // снабжение/склад (для заявок) или доступ к нарядам, и админ
  private async assertReadAccess(
    att: { byId: string; request: null | { requesterId: string; chainSteps: { approverId: string }[] }; order: null | { requesterId: string; chainSteps: { approverId: string }[] } },
    u: AuthUser,
  ) {
    if (u.role === Role.ADMIN || att.byId === u.id) return;
    if (att.request) {
      const r = att.request;
      if (r.requesterId === u.id || r.chainSteps.some((s) => s.approverId === u.id)) return;
      if (u.role === Role.SUPPLY || u.role === Role.WAREHOUSE) return;
      throw new ForbiddenException('Нет доступа к этому вложению');
    }
    if (att.order) {
      const o = att.order;
      if (o.requesterId === u.id || o.chainSteps.some((s) => s.approverId === u.id)) return;
      const me = await this.prisma.user.findUnique({ where: { id: u.id }, select: { ordersAccess: true } });
      if (me?.ordersAccess) return;
      throw new ForbiddenException('Нет доступа к этому вложению');
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    const att = await this.prisma.attachment.findUnique({ where: { id } });
    if (att && att.byId !== u.id && u.role !== 'ADMIN') throw new ForbiddenException('Удалить может загрузивший или админ');
    if (att) {
      await this.files.remove(att.key).catch(() => undefined);
      await this.prisma.attachment.delete({ where: { id } });
    }
    return { ok: true };
  }
}
