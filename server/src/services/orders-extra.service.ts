import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DecisionAction, OrderStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { MailService } from './mail.service';
import { AuthUser } from '../decorators/current-user.decorator';

const FULL = {
  lines: true,
  chainSteps: { orderBy: { order_: 'asc' as const } },
  events: { orderBy: { at: 'asc' as const } },
  attachments: true,
};

@Injectable()
export class OrdersExtraService {
  constructor(private prisma: PrismaService, private mail: MailService) {}

  private async getOne(id: string) {
    const o = await this.prisma.order.findUnique({ where: { id }, include: FULL });
    if (!o) throw new NotFoundException('Наряд не найден');
    return o;
  }

  /** править состав может: текущий согласующий · админ · автор ОТКЛОНЁННОГО наряда ·
   *  автор, пока наряд ещё ни разу не решался (аналог правки заявок до первого решения) */
  private async canEditLines(o: Awaited<ReturnType<OrdersExtraService['getOne']>>, u: AuthUser) {
    if (u.role === Role.ADMIN) return true;
    if (o.status === OrderStatus.REJECTED && o.requesterId === u.id) return true;
    if (o.status !== OrderStatus.APPROVAL) return false;
    if (o.chainSteps.some((s) => s.order_ === o.currentStageIndex && s.approverId === u.id)) return true;
    return o.requesterId === u.id && o.chainSteps.every((s) => !s.decision);
  }

  /** кол-во — любой, кто вправе править; ЦЕНУ — только canPrice или админ. Значения клампятся к ≥ 0. */
  async patchLine(id: string, lineId: string, u: AuthUser, patch: { qty?: string; price?: number }) {
    const o = await this.getOne(id);
    if (!(await this.canEditLines(o, u))) throw new ForbiddenException('Сейчас наряд править нельзя');
    if (!o.lines.some((l) => l.id === lineId)) throw new NotFoundException('Позиция не найдена');
    const data: Prisma.OrderLineUpdateInput = {};
    if (patch.qty !== undefined) {
      const n = Number(String(patch.qty).replace(',', '.'));
      data.qty = Number.isFinite(n) && n < 0 ? '0' : String(patch.qty ?? '');
    }
    if (patch.price !== undefined) {
      if (u.role !== Role.ADMIN) {
        const me = await this.prisma.user.findUnique({ where: { id: u.id }, select: { canPrice: true } });
        if (!me?.canPrice) throw new ForbiddenException('У вас нет права менять цены в нарядах');
      }
      data.price = new Prisma.Decimal(Math.max(0, Number(patch.price) || 0));
    }
    await this.prisma.orderLine.update({ where: { id: lineId }, data });
    await this.prisma.orderEvent.create({
      data: { orderId: id, action: DecisionAction.EDITED, byId: u.id, byName: u.name, comment: 'Изменён состав наряда' },
    });
    return this.getOne(id);
  }

  async removeLine(id: string, lineId: string, u: AuthUser) {
    const o = await this.getOne(id);
    if (!(await this.canEditLines(o, u))) throw new ForbiddenException('Сейчас наряд править нельзя');
    await this.prisma.orderLine.deleteMany({ where: { id: lineId, orderId: id } });
    await this.prisma.orderEvent.create({
      data: { orderId: id, action: DecisionAction.EDITED, byId: u.id, byName: u.name, comment: 'Позиция удалена' },
    });
    return this.getOne(id);
  }

  /** отклонённый наряд: автор дорабатывает и отправляет повторно (маршрут с нуля) */
  async resubmit(id: string, u: AuthUser) {
    const o = await this.getOne(id);
    if (o.requesterId !== u.id && u.role !== Role.ADMIN) throw new ForbiddenException('Повторно подать может автор');
    if (o.status !== OrderStatus.REJECTED) throw new BadRequestException('Повторная подача — только для отклонённых');
    if (o.lines.length === 0) throw new BadRequestException('В наряде нет ни одной позиции — добавьте работы');
    await this.prisma.$transaction(async (tx) => {
      await tx.orderApprovalStep.updateMany({
        where: { orderId: id }, data: { decision: null, decidedAt: null, comment: null },
      });
      await tx.order.update({ where: { id }, data: { status: OrderStatus.APPROVAL, currentStageIndex: 0 } });
      await tx.orderEvent.create({
        data: { orderId: id, action: DecisionAction.RESUBMITTED, byId: u.id, byName: u.name, comment: 'Отправлен повторно после доработки' },
      });
    });
    const first = o.chainSteps[0];
    if (first) {
      const appr = await this.prisma.user.findUnique({ where: { id: first.approverId } });
      if (appr?.email) this.mail.notifyApprovalNeeded(appr.email, appr.name, o.number, `/orders/${id}`).catch(() => undefined);
    }
    return this.getOne(id);
  }
}
