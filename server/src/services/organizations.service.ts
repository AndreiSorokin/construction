import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TokenService } from './token.service';
import { hashPassword } from '../common/password.util';
import { isReservedSlug, slugify } from '../common/slug.util';
import { RegisterOrganizationDto } from '../dto/organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService, private tokens: TokenService) {}

  /** проверка адреса организации «на лету», пока юзер его редактирует на форме регистрации */
  async checkSlug(raw: string): Promise<{ slug: string; available: boolean; reason?: 'empty' | 'reserved' | 'taken' }> {
    const slug = slugify(raw);
    if (!slug) return { slug, available: false, reason: 'empty' };
    if (isReservedSlug(slug)) return { slug, available: false, reason: 'reserved' };
    const exists = await this.prisma.organization.findUnique({ where: { slug } });
    return { slug, available: !exists, reason: exists ? 'taken' : undefined };
  }

  async register(dto: RegisterOrganizationDto, ctx: { userAgent?: string; ip?: string }) {
    const slug = slugify(dto.slug || dto.orgName);
    if (!slug || isReservedSlug(slug)) {
      throw new BadRequestException('Недопустимое название организации — не удалось получить адрес');
    }
    const taken = await this.prisma.organization.findUnique({ where: { slug } });
    if (taken) throw new BadRequestException('Такой адрес уже занят — выберите другой');

    const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.adminEmail } });
    if (existingEmail) throw new BadRequestException('Этот email уже используется');

    const passwordHash = await hashPassword(dto.adminPassword);

    const { org, admin } = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: dto.orgName, slug } });
      const admin = await tx.user.create({
        data: {
          organizationId: org.id,
          login: dto.adminEmail,
          email: dto.adminEmail,
          name: 'Администратор',
          role: 'ADMIN',
          passwordHash,
          ordersAccess: true,
          canPrice: true,
        },
      });
      await tx.appSetting.create({ data: { organizationId: org.id } });
      return { org, admin };
    });

    const pair = await this.tokens.issuePair(admin, ctx);
    return {
      org: { id: org.id, name: org.name, slug: org.slug },
      user: {
        id: admin.id, login: admin.login, name: admin.name, role: admin.role,
        departmentId: admin.departmentId, isLead: admin.isLead, ordersAccess: admin.ordersAccess,
        email: admin.email, isActive: admin.isActive, theme: admin.theme,
      },
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    };
  }
}
