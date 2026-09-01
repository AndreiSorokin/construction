import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { hashPassword } from '../common/password.util';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { AuthUser } from '../decorators/current-user.decorator';

const pub = {
  id: true, login: true, name: true, role: true, departmentId: true,
  isLead: true, ordersAccess: true, canPrice: true, theme: true, avatarKey: true, isActive: true, email: true, createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({ select: pub, orderBy: { createdAt: 'asc' } });
  }

  private async freeLogin(organizationId: string): Promise<string> {
    const users = await this.prisma.user.findMany({ where: { organizationId }, select: { login: true } });
    const taken = new Set(users.map((u) => u.login.toLowerCase()));
    let n = users.length + 1;
    while (taken.has(`user${n}`)) n++;
    return `user${n}`;
  }

  async create(organizationId: string, dto: CreateUserDto) {
    const login = (dto.login || '').trim() || (await this.freeLogin(organizationId));
    const dup = await this.prisma.user.findFirst({ where: { organizationId, login: { equals: login, mode: 'insensitive' } } });
    if (dup) throw new BadRequestException(`Логин «${login}» уже занят — выберите другой`);
    return this.prisma.user.create({
      data: {
        organizationId,
        login,
        name: dto.name,
        role: dto.role,
        departmentId: dto.departmentId || null,
        ordersAccess: dto.ordersAccess ?? false,
        isLead: dto.isLead ?? false,
        email: dto.email || null,
        passwordHash: await hashPassword(dto.password),
      },
      select: pub,
    });
  }

  async update(id: string, dto: UpdateUserDto, current: AuthUser) {
    // админ не может понизить/сменить себе роль или деактивировать сам себя —
    // иначе можно случайно потерять доступ к админке без возможности вернуть его
    if (id === current.id) {
      if (dto.role && dto.role !== current.role) throw new ForbiddenException('Нельзя изменить собственную роль');
      if (dto.isActive === false) throw new ForbiddenException('Нельзя деактивировать самого себя');
    }
    if (dto.login) {
      const dup = await this.prisma.user.findFirst({
        where: { organizationId: current.orgId, login: { equals: dto.login, mode: 'insensitive' }, NOT: { id } },
      });
      if (dup) throw new BadRequestException(`Логин «${dto.login}» уже занят — выберите другой`);
    }
    return this.prisma.user.update({ where: { id }, data: { ...dto }, select: pub });
  }

  /**
   * «Удаление» сотрудника = деактивация (заявки/наряды на него ссылаются — жёсткое удаление сломало бы историю).
   * При этом: убирается из маршрутов согласования, снимается как исполнитель,
   * зависшие на нём этапы согласования заявок И нарядов перескакивают дальше — ничего не виснет.
   */
  async deactivate(id: string, current: AuthUser) {
    if (id === current.id) throw new ForbiddenException('Нельзя уволить самого себя');
    const byName = current.name;
    await this.prisma.$transaction(async (tx) => {
      await tx.supplyChainStep.deleteMany({ where: { approverId: id } });
      await tx.orderChainStep.deleteMany({ where: { approverId: id } });
      await tx.request.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } });
      await tx.objectAccess.deleteMany({ where: { userId: id } });

      // заявки на согласовании, ждущие ЕГО решения
      const reqs = await tx.request.findMany({
        where: { status: 'APPROVAL', chainSteps: { some: { approverId: id, decision: null } } },
        include: { chainSteps: { orderBy: { order: 'asc' } } },
      });
      for (const r of reqs) {
        await tx.requestApprovalStep.deleteMany({ where: { requestId: r.id, approverId: id, decision: null } });
        const left = r.chainSteps.filter((s) => !(s.approverId === id && !s.decision));
        // перенумеровать и пересчитать текущий этап
        for (let i = 0; i < left.length; i++) {
          if (left[i].order !== i) await tx.requestApprovalStep.update({ where: { id: left[i].id }, data: { order: i } });
        }
        const decided = left.filter((s) => s.decision).length;
        const idx = Math.min(decided, left.length);
        await tx.request.update({
          where: { id: r.id },
          data: idx >= left.length ? { status: 'SUPPLY', currentStageIndex: left.length } : { currentStageIndex: idx },
        });
        await tx.requestEvent.create({
          data: { requestId: r.id, action: 'EDITED', byId: id, byName, comment: 'Согласующий удалён — этап снят автоматически' },
        });
      }

      // наряды на согласовании, ждущие ЕГО решения
      const ords = await tx.order.findMany({
        where: { status: 'APPROVAL', chainSteps: { some: { approverId: id, decision: null } } },
        include: { chainSteps: { orderBy: { order_: 'asc' } } },
      });
      for (const o of ords) {
        await tx.orderApprovalStep.deleteMany({ where: { orderId: o.id, approverId: id, decision: null } });
        const left = o.chainSteps.filter((s) => !(s.approverId === id && !s.decision));
        for (let i = 0; i < left.length; i++) {
          if (left[i].order_ !== i) await tx.orderApprovalStep.update({ where: { id: left[i].id }, data: { order_: i } });
        }
        const decided = left.filter((s) => s.decision).length;
        const idx = Math.min(decided, left.length);
        await tx.order.update({
          where: { id: o.id },
          data: idx >= left.length ? { status: 'APPROVED', currentStageIndex: left.length } : { currentStageIndex: idx },
        });
        await tx.orderEvent.create({
          data: { orderId: o.id, action: 'EDITED', byId: id, byName, comment: 'Согласующий удалён — этап снят автоматически' },
        });
      }

      await tx.user.update({ where: { id }, data: { isActive: false } });
      await tx.refreshToken.updateMany({ where: { userId: id, revoked: false }, data: { revoked: true } });
    });
    return { ok: true };
  }

  async resetPassword(id: string, newPassword: string) {
    await this.prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(newPassword) } });
    // сбрасываем активные сессии пользователя
    await this.prisma.refreshToken.updateMany({ where: { userId: id, revoked: false }, data: { revoked: true } });
    return { ok: true };
  }
}
