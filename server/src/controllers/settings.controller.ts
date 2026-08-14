import {
  BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { SettingsService } from '../services/settings.service';
import { Public } from '../decorators/public.decorator';
import { CurrentUser, AuthUser } from '../decorators/current-user.decorator';

const MAX_IMG = 5 * 1024 * 1024;

@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Public()
  @Get()
  get() { return this.settings.get(); }

  @Patch('urgent-limit')
  urgentLimit(@Body('urgentLimit') n: number, @CurrentUser() u: AuthUser) {
    return this.settings.setUrgentLimit(u, n);
  }

  @Post('logo')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMG } }))
  logo(
    @UploadedFile() file: Express.Multer.File,
    @Body('w') w: string,
    @Body('h') h: string,
    @CurrentUser() u: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Файл не передан');
    return this.settings.setLogo(u, file, w ? Number(w) : undefined, h ? Number(h) : undefined);
  }

  @Delete('logo')
  clearLogo(@CurrentUser() u: AuthUser) { return this.settings.clearLogo(u); }

  // отдаёт файл логотипа через собственный домен, а не подписанную ссылку на S3-бакет —
  // публичный: логотип виден и на странице входа, до авторизации
  @Public()
  @Get('logo/file')
  async logoFile(@Res() res: Response) {
    const logo = await this.settings.getLogoObject();
    if (!logo) throw new NotFoundException('Логотип не загружен');
    res.set('Content-Type', logo.object.ContentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    if (logo.object.ContentLength) res.set('Content-Length', String(logo.object.ContentLength));
    (logo.object.Body as NodeJS.ReadableStream).pipe(res);
  }

  @Patch('theme')
  theme(@Body('theme') theme: string, @CurrentUser() u: AuthUser) { return this.settings.setTheme(u, theme); }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMG } }))
  avatar(@UploadedFile() file: Express.Multer.File, @CurrentUser() u: AuthUser) {
    if (!file) throw new BadRequestException('Файл не передан');
    return this.settings.setAvatar(u, file);
  }

  @Get('avatar/:userId')
  avatarUrl(@Param('userId') userId: string) { return this.settings.avatarUrl(userId); }
}
