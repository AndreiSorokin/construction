import { Body, Controller, Get, HttpCode, NotFoundException, Post, Query, Req, Res } from '@nestjs/common';
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

  /**
   * «Привратник» для On-Demand TLS в Caddy (Caddyfile: on_demand_tls { ask ... }) — перед тем как
   * выпустить сертификат для нового {slug}.<rootDomain>, Caddy спрашивает сюда, стоит ли вообще
   * это делать. 200 — да (реальная организация, либо общая точка входа login.<rootDomain>),
   * 404 — нет, не тратим лимиты Let's Encrypt на случайные поддомены.
   */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('tls-ask')
  async tlsAsk(@Query('domain') domain: string) {
    const rootDomain = this.config.get<string>('org.rootDomain') || '';
    const host = (domain || '').toLowerCase();
    if (rootDomain && host === `login.${rootDomain}`) return;
    const slug = rootDomain && host.endsWith(`.${rootDomain}`) ? host.slice(0, -(`.${rootDomain}`.length)) : '';
    const check = await this.orgs.checkSlug(slug);
    if (check.reason !== 'taken') throw new NotFoundException();
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
