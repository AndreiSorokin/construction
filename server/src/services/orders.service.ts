import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { MailService } from './mail.service';
import { DecisionAction, OrderStatus, Role } from '@prisma/client';
import { CreateOrderDto, OrderDecideDto } from '../dto/order.dto';
import { AuthUser } from '../decorators/current-user.decorator';

const FULL = {
  lines: true,
  chainSteps: { orderBy: { order_: 'asc' as const } },
  events: { orderBy: { at: 'asc' as const } },
  ip: true,
  object: true,
};

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService, private mail: MailService) {}

  private async nextNumber(organizationId: string): Promise<string> {
    const c = await this.prisma.counter.upsert({
      where: { organizationId_key: { organizationId, key: 'order' } },
      create: { organizationId, key: 'order', value: 1 },
      update: { value: { increment: 1 } },
    });
    return `Н-${String(c.value).padStart(4, '0')}`;
  }

  async create(dto: CreateOrderDto, user: AuthUser) {
    const me = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!me) throw new ForbiddenException();
    if (user.role !== Role.ADMIN && !me.ordersAccess) throw new ForbiddenException('Нет доступа к нарядам');
    const departmentId = dto.departmentId || me.departmentId;
    if (!departmentId) throw new BadRequestException('Не указан отдел');
    if (!dto.lines || dto.lines.length === 0) throw new BadRequestException('Наряд пуст — добавьте работы');

    const steps = await this.prisma.orderChainStep.findMany({
      where: { departmentId },
      orderBy: { order: 'asc' },
    });
    const approvers = await this.prisma.user.findMany({ where: { id: { in: steps.map((s) => s.approverId) } } });
    const nameOf = (id: string) => approvers.find((a) => a.id === id);
    const hasChain = steps.length > 0;
    const number = await this.nextNumber(user.orgId);

    const created = await this.prisma.order.create({
      data: {
        organizationId: user.orgId,
        number,
        departmentId,
        requesterId: user.id,
        objectId: dto.objectId || null,
        ipId: dto.ipId || null,
        period: dto.period,
        catalogId: dto.catalogId || null,
        note: dto.note ?? '',
        status: hasChain ? OrderStatus.APPROVAL : OrderStatus.APPROVED,
        currentStageIndex: 0,
        lines: {
          create: dto.lines.map((l) => ({
            workId: l.workId || null,
            name: l.name,
            unit: l.unit,
            price: String(l.price),
            qty: l.qty ?? '',
          })),
        },
        chainSteps: {
          create: steps.map((s) => {
            const u = nameOf(s.approverId);
            return {
              order_: s.order,
              approverId: s.approverId,
              approverName: u?.name ?? '—',
              role: (u?.role as Role) ?? Role.APPROVER,
              label: s.label,
            };
          }),
        },
        events: { create: { action: DecisionAction.CREATED, byId: user.id, byName: user.name } },
      },
      include: FULL,
    });

    if (hasChain) {
      const first = nameOf(steps[0].approverId);
      if (first?.email) {
        this.mail.notifyApprovalNeeded(first.email, first.name, number, `/orders/${created.id}`).catch(() => undefined);
      }
    }
    return created;
  }

  list(user: AuthUser, query: { period?: string } = {}) {
    const base = query.period ? { period: query.period } : {};
    const scope =
      user.role === Role.ADMIN
        ? {}
        : { OR: [{ requesterId: user.id }, { chainSteps: { some: { approverId: user.id } } }] };
    return this.prisma.order.findMany({
      where: { AND: [base, scope] },
      include: FULL,
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getOne(id: string) {
    const o = await this.prisma.order.findUnique({ where: { id }, include: FULL });
    if (!o) throw new NotFoundException('Наряд не найден');
    return o;
  }

  async decide(id: string, user: AuthUser, dto: OrderDecideDto) {
    if (dto.action === 'approve') {
      const cnt = await this.prisma.orderLine.count({ where: { orderId: id } });
      if (cnt === 0) throw new BadRequestException('В наряде нет ни одной позиции — согласовать его нельзя');
    }
    const o = await this.getOne(id);
    if (o.status !== OrderStatus.APPROVAL) throw new BadRequestException('Наряд не на согласовании');
    const step = o.chainSteps.find((s) => s.order_ === o.currentStageIndex);
    if (!step || step.approverId !== user.id) throw new ForbiddenException('Сейчас не ваш этап согласования');

    const isApprove = dto.action === 'approve';
    await this.prisma.$transaction(async (tx) => {
      await tx.orderApprovalStep.update({
        where: { id: step.id },
        data: {
          decision: isApprove ? DecisionAction.APPROVED : DecisionAction.REJECTED,
          decidedAt: new Date(),
          comment: dto.comment ?? null,
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: o.id,
          action: isApprove ? DecisionAction.APPROVED : DecisionAction.REJECTED,
          byId: user.id,
          byName: user.name,
          stage: step.label,
          comment: dto.comment ?? null,
        },
      });
      if (!isApprove) {
        await tx.order.update({ where: { id: o.id }, data: { status: OrderStatus.REJECTED } });
        return;
      }
      const last = o.currentStageIndex + 1 >= o.chainSteps.length;
      await tx.order.update({
        where: { id: o.id },
        data: last
          ? { status: OrderStatus.APPROVED, currentStageIndex: o.chainSteps.length }
          : { currentStageIndex: o.currentStageIndex + 1 },
      });
    });
    return this.getOne(id);
  }
}
