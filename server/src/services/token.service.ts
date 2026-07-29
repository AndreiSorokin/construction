import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { User } from '@prisma/client';

/**
 * Управление токенами.
 *
 * Access — короткоживущий JWT (хранится во фронте в памяти).
 * Refresh — одноразовый opaque-токен вида "<id>.<secret>" в httpOnly-cookie.
 *   В БД храним sha256(secret). Токены объединены в «семью» (familyId = сессия).
 *
 * Гонка обновления (две вкладки / target=_blank одновременно дергают /auth/refresh):
 *   1) Ротацию «захватывает» атомарный updateMany(where rotatedAt=null) — выигрывает один запрос.
 *   2) Проигравшие в пределах GRACE-окна считаются легитимными (получают новый токен той же семьи),
 *      а НЕ компрометацией. Повтор вне окна или отозванного токена → отзыв всей семьи (кража).
 *   Дополнительно фронтенд делает single-flight через Web Locks (см. web/lib/auth/refresh-client.ts),
 *   так что в норме параллельный refresh к серверу вообще не уходит.
 */
@Injectable()
export class TokenService {
  // окно, в течение которого «опоздавший» параллельный refresh ещё считается своим
  private readonly GRACE_MS = 20_000;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private sha256(v: string): string {
    return createHash('sha256').update(v).digest('hex');
  }

  private signAccess(user: Pick<User, 'id' | 'role' | 'name'>): string {
    return this.jwt.sign(
      { sub: user.id, role: user.role, name: user.name },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessTtl') || '15m',
      },
    );
  }

  /** Создать пару токенов. Если familyId не задан — начинается новая сессия. */
  async issuePair(
    user: User,
    ctx: { familyId?: string; userAgent?: string; ip?: string } = {},
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date; familyId: string }> {
    const secret = randomBytes(48).toString('base64url');
    const ttlDays = Number(this.config.get('jwt.refreshTtlDays') || 30);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const row = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId: ctx.familyId || randomBytes(16).toString('hex'),
        tokenHash: this.sha256(secret),
        expiresAt,
        userAgent: ctx.userAgent?.slice(0, 256),
        ip: ctx.ip?.slice(0, 64),
      },
    });

    return {
      accessToken: this.signAccess(user),
      refreshToken: `${row.id}.${secret}`,
      expiresAt,
      familyId: row.familyId,
    };
  }

  private safeEqualHex(a: string, b: string): boolean {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  }

  /**
   * Обменять refresh-токен на новую пару (с ротацией и защитой от гонки).
   * Возвращает новую пару либо бросает UnauthorizedException.
   */
  async rotate(
    rawToken: string,
    ctx: { userAgent?: string; ip?: string } = {},
  ): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date; familyId: string }> {
    const dot = rawToken.indexOf('.');
    if (dot <= 0) throw new UnauthorizedException('bad_refresh');
    const id = rawToken.slice(0, dot);
    const secret = rawToken.slice(dot + 1);

    const row = await this.prisma.refreshToken.findUnique({ where: { id } });
    if (!row || !this.safeEqualHex(row.tokenHash, this.sha256(secret))) {
      throw new UnauthorizedException('invalid_refresh');
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('expired_refresh');
    }
    // повторное использование уже отозванного токена → кража → гасим всю семью
    if (row.revoked) {
      await this.revokeFamily(row.familyId);
      throw new UnauthorizedException('reuse_detected');
    }

    const user = await this.prisma.user.findUnique({ where: { id: row.userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('user_inactive');

    // Пытаемся атомарно «захватить» ротацию: победит ровно один параллельный запрос.
    const claim = await this.prisma.refreshToken.updateMany({
      where: { id, rotatedAt: null, revoked: false },
      data: { rotatedAt: new Date() },
    });

    if (claim.count === 1) {
      // Мы выиграли ротацию — выдаём преемника в той же семье.
      const pair = await this.issuePair(user, {
        familyId: row.familyId,
        userAgent: ctx.userAgent,
        ip: ctx.ip,
      });
      const newId = pair.refreshToken.slice(0, pair.refreshToken.indexOf('.'));
      await this.prisma.refreshToken.update({ where: { id }, data: { replacedById: newId } });
      return pair;
    }

    // Ротацию уже выполнил другой запрос. Решаем — гонка вкладок или кража.
    const fresh = await this.prisma.refreshToken.findUnique({ where: { id } });
    if (!fresh || fresh.revoked) {
      if (fresh) await this.revokeFamily(fresh.familyId);
      throw new UnauthorizedException('reuse_detected');
    }
    const since = Date.now() - (fresh.rotatedAt?.getTime() ?? 0);
    if (since <= this.GRACE_MS) {
      // Легитимная гонка (вторая вкладка/таб) в пределах grace-окна — выдаём токен-«близнец».
      return this.issuePair(user, { familyId: fresh.familyId, userAgent: ctx.userAgent, ip: ctx.ip });
    }
    // Старый токен переиспользован вне окна → компрометация.
    await this.revokeFamily(fresh.familyId);
    throw new UnauthorizedException('reuse_detected');
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revoked: false },
      data: { revoked: true },
    });
  }

  async revokeByRawToken(rawToken: string): Promise<void> {
    const dot = rawToken.indexOf('.');
    if (dot <= 0) return;
    const id = rawToken.slice(0, dot);
    const row = await this.prisma.refreshToken.findUnique({ where: { id } });
    if (row) await this.revokeFamily(row.familyId);
  }

  /** Чистка просроченных/использованных токенов (вызывать по расписанию). */
  async pruneExpired(): Promise<number> {
    const res = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revoked: true, rotatedAt: { lt: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
        ],
      },
    });
    return res.count;
  }
}
