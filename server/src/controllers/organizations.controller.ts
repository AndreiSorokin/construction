import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { OrganizationsService } from '../services/organizations.service';
import { RegisterOrganizationDto } from '../dto/organization.dto';
import { Public } from '../decorators/public.decorator';

const REFRESH_COOKIE = 'refresh_token';

@Controller('organizations')
export class OrganizationsController {
  constructor(private orgs: OrganizationsService, private config: ConfigService) {}

  private cookieOpts() {
    return {
      httpOnly: true,
      secure: this.config.get<boolean>('cookie.secure') ?? false,
      sameSite: (this.config.get<'lax' | 'none' | 'strict'>('cookie.sameSite') ?? 'lax'),
      path: '/api/auth',
      maxAge: Number(this.config.get('jwt.refreshTtlDays') || 30) * 24 * 60 * 60 * 1000,
    };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } }) // проверка вводится «на лету», пока юзер печатает адрес
  @Get('check-slug')
  checkSlug(@Query('slug') slug: string) {
    return this.orgs.checkSlug(slug || '');
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // не более 5 регистраций в минуту с одного IP
  @HttpCode(201)
  @Post('register')
  async register(@Body() dto: RegisterOrganizationDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { org, user, accessToken, refreshToken } = await this.orgs.register(dto, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOpts());
    return { org, accessToken, user };
  }
}
