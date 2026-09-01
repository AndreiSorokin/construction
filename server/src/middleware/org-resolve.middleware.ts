import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../services/prisma.service';
import type { Organization } from '@prisma/client';

declare module 'express-serve-static-core' {
  interface Request {
    org?: Organization | null;
  }
}

/**
 * Резолвит организацию по поддомену запроса ({slug}.<rootDomain>) и кладёт в req.org.
 * Нужен только публичным ручкам (логин, регистрация) — у уже авторизованных запросов
 * organizationId уже есть в самом JWT.
 * В деве нет реальных поддоменов — фолбэк через заголовок X-Org-Slug либо ORG_DEFAULT_SLUG.
 */
@Injectable()
export class OrgResolveMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const rootDomain = this.config.get<string>('org.rootDomain') || '';
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    const hostname = host.split(':')[0];

    let slug: string | undefined;
    if (rootDomain && hostname.endsWith(`.${rootDomain}`)) {
      slug = hostname.slice(0, -(`.${rootDomain}`.length));
    }
    if (!slug) {
      slug = (req.headers['x-org-slug'] as string) || this.config.get<string>('org.defaultSlug');
    }

    req.org = slug ? await this.prisma.organization.findUnique({ where: { slug } }) : null;
    next();
  }
}
