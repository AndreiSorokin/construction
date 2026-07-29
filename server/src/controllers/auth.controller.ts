import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
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
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // не более 5 попыток входа в минуту с одного IP
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.auth.login(dto.login, dto.password, this.ctx(req));
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOpts());
    return { accessToken, user };
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
