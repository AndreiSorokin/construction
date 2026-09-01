import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';
import { LoginDto, ChangePasswordDto } from '../dto/login.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { PrismaService } from '../services/prisma.service';

const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  private cookieOpts() {
    return {
      httpOnly: true,
      secure: this.config.get<boolean>('cookie.secure') ?? false,
      sameSite: (this.config.get<'lax' | 'none' | 'strict'>('cookie.sameSite') ?? 'lax'),
      path: '/api/auth', // cookie уходит только на эндпоинты авторизации
      maxAge: Number(this.config.get('jwt.refreshTtlDays') || 30) * 24 * 60 * 60 * 1000,
    };
  }

  private ctx(req: Request) {
    return { userAgent: req.headers['user-agent'], ip: req.ip };
  }

  @Public()
  // лимит общий на весь IP (офис/NAT — много разных сотрудников с одного адреса), поэтому
  // держим его заметно выше «ручного» перебора логинов, но всё ещё далеко от брутфорса пароля
  @Throttle({ default: { limit: 30, ttl: 60_000 } }) // не более 30 попыток входа в минуту с одного IP
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!req.org) throw new UnauthorizedException('Организация не найдена');
    const { user, accessToken, refreshToken } = await this.auth.login(req.org.id, dto.login, dto.password, this.ctx(req));
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOpts());
    // клиент запоминает slug — без реального поддомена (локальная разработка) это единственный
    // способ при следующем входе снова попасть в ту же организацию (см. X-Org-Slug в middleware)
    return { accessToken, user, org: { id: req.org.id, slug: req.org.slug, name: req.org.name } };
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    const { accessToken, refreshToken } = await this.auth.refresh(raw, this.ctx(req));
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOpts());
    return { accessToken };
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { ...this.cookieOpts(), maxAge: undefined });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() u: AuthUser) {
    const full = await this.prisma.user.findUnique({ where: { id: u.id } });
    return this.auth.publicUser(full!);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Post('change-password')
  async changePassword(@CurrentUser('id') id: string, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(id, dto.oldPassword, dto.newPassword);
    return { ok: true };
  }
}
