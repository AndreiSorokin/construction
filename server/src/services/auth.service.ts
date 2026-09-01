import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TokenService } from './token.service';
import { verifyPassword, hashPassword } from '../common/password.util';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private tokens: TokenService) {}

  async validateUser(organizationId: string, login: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findFirst({ where: { organizationId, login } });
    if (!user || !user.isActive) return null;
    return (await verifyPassword(password, user.passwordHash)) ? user : null;
  }

  async login(organizationId: string, login: string, password: string, ctx: { userAgent?: string; ip?: string }) {
    const user = await this.validateUser(organizationId, login, password);
    if (!user) throw new UnauthorizedException('Неверный логин или пароль');
    const pair = await this.tokens.issuePair(user, ctx);
    return { user: this.publicUser(user), ...pair };
  }

  async refresh(rawToken: string | undefined, ctx: { userAgent?: string; ip?: string }) {
    if (!rawToken) throw new UnauthorizedException('Нет refresh-токена');
    return this.tokens.rotate(rawToken, ctx);
  }

  async logout(rawToken?: string) {
    if (rawToken) await this.tokens.revokeByRawToken(rawToken);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!(await verifyPassword(oldPassword, user.passwordHash)))
      throw new UnauthorizedException('Текущий пароль неверный');
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    // смена пароля гасит все активные сессии пользователя
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }

  publicUser(u: User) {
    return {
      id: u.id,
      login: u.login,
      name: u.name,
      role: u.role,
      departmentId: u.departmentId,
      isLead: u.isLead,
      ordersAccess: u.ordersAccess,
      email: u.email,
      isActive: u.isActive,
      theme: u.theme,
    };
  }
}
