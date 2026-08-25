import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { MailService } from './mail.service';
import {
  DecisionAction, Priority, Prisma, RequestStatus, RequestType, Role, StockStatus, SupplyStage,
} from '@prisma/client';
import { CreateRequestDto, DecideDto } from '../dto/request.dto';
import { AuthUser } from '../decorators/current-user.decorator';

const PREFIX: Record<RequestType, string> = {
  TMC: 'ТМЦ', TRANSPORT: 'ТР', QUARRY: 'КАР', FUNDS: 'ДС', FUEL: 'ТОП', TRAVEL: 'КМ', PRODUCTION: 'ПР',
};

// общий include для заявки: используется и здесь, и в requests-extra.service.ts —
// один источник, чтобы «полная» форма заявки не расходилась между сервисами
export const FULL = {
  items: true,
  chainSteps: { orderBy: { order: 'asc' as const } },
  events: { orderBy: { at: 'asc' as const } },
  supplyNotes: { orderBy: { at: 'asc' as const } },
  attachments: true,
  // исходные заявки сводной — без этого «Из исходных заявок» в карточке всегда пустая
  consolidatedFrom: {
    include: { supplyNotes: { orderBy: { at: 'asc' as const } }, attachments: true },
  },
};

@Injectable()
export class RequestsService {
  constructor(private prisma: PrismaService, private mail: MailService) {}

  private async nextNumber(type: RequestType): Promise<string> {
    const c = await this.prisma.counter.upsert({
      where: { key: `req:${type}` },
      create: { key: `req:${type}`, value: 1 },
      update: { value: { increment: 1 } },
    });
    return `${PREFIX[type]}-${String(c.value).padStart(4, '0')}`;
  }

  async create(dto: CreateRequestDto, user: AuthUser) {
    // снапшот маршрута согласования для отдела+типа
    const steps = await this.prisma.supplyChainStep.findMany({
      where: { departmentId: dto.departmentId, type: dto.type },
      orderBy: { order: 'asc' },
    });
    const approverIds = steps.map((s) => s.approverId);
    const approvers = await this.prisma.user.findMany({ where: { id: { in: approverIds } } });
    const nameOf = (id: string) => approvers.find((a) => a.id === id);

    const number = await this.nextNumber(dto.type);
    const hasChain = steps.length > 0;

    // лимит «Срочно» в день: при исчерпании приоритет тихо понижается до «Высокий» с записью в историю
    let priority = dto.priority ?? Priority.NORMAL;
    let downgraded = false;
    if (priority === Priority.URGENT) {
      const setting = await this.prisma.appSetting.upsert({ where: { id: 'app' }, create: { id: 'app' }, update: {} });
      if (setting.urgentLimit > 0) {
        const from = new Date(); from.setHours(0, 0, 0, 0);
        const todayUrgent = await this.prisma.request.count({ where: { priority: Priority.URGENT, createdAt: { gte: from } } });
        if (todayUrgent >= setting.urgentLimit) { priority = Priority.HIGH; downgraded = true; }
      }
    }

    const created = await this.prisma.request.create({
      data: {
        number,
        type: dto.type,
        departmentId: dto.departmentId,
        requesterId: user.id,
        objectId: dto.objectId || null,
        priority,
        note: dto.note ?? '',
        due: dto.due ? new Date(dto.due) : null,
        fields: (dto.fields ?? {}) as Prisma.InputJsonValue,
        status: hasChain ? RequestStatus.APPROVAL : RequestStatus.SUPPLY,
        currentStageIndex: 0,
        items: { create: (dto.items || []).map((it) => ({ name: it.name, unit: it.unit, qty: it.qty ?? '', note: it.note ?? '' })) },
        chainSteps: {
          create: steps.map((s) => {
            const u = nameOf(s.approverId);
            return {
              order: s.order,
              approverId: s.approverId,
              approverName: u?.name ?? '—',
              role: u?.role ?? Role.APPROVER,
              label: s.label,
            };
          }),
        },
        events: {
          create: [
            { action: DecisionAction.CREATED, byId: user.id, byName: user.name },
            ...(downgraded ? [{ action: DecisionAction.EDITED, byId: user.id, byName: user.name, comment: 'Дневной лимит «Срочно» исчерпан — приоритет понижен до «Высокий»' }] : []),
            ...(!hasChain ? [{ action: DecisionAction.EDITED, byId: user.id, byName: user.name, comment: 'Маршрут согласования для отдела и типа не настроен — заявка передана в снабжение без согласования' }] : []),
          ],
        },
      },
      include: FULL,
    });

    // уведомление первому согласующему (если есть e-mail)
    if (hasChain) {
      const first = nameOf(steps[0].approverId);
      if (first?.email) {
        this.mail.notifyApprovalNeeded(first.email, first.name, number, `/requests/${created.id}`).catch(() => undefined);
      }
    }
    return created;
  }

  list(user: AuthUser, query: { status?: RequestStatus; type?: RequestType } = {}) {
    const base: Prisma.RequestWhereInput = {};
    if (query.status) base.status = query.status;
    if (query.type) base.type = query.type;

    // видимость по роли
    let scope: Prisma.RequestWhereInput;
    switch (user.role as Role) {
      case Role.ADMIN:
      case Role.SUPPLY:
      case Role.WAREHOUSE:
        scope = {};
        break;
      case Role.APPROVER:
        scope = { OR: [{ requesterId: user.id }, { chainSteps: { some: { approverId: user.id } } }] };
        break;
      default: // REQUESTER
        scope = { requesterId: user.id };
    }
    return this.prisma.request.findMany({
      where: { AND: [base, scope] },
      include: FULL,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(id: string) {
    const r = await this.prisma.request.findUnique({ where: { id }, include: FULL });
    if (!r) throw new NotFoundException('Заявка не найдена');
    return r;
  }

  async decide(id: string, user: AuthUser, dto: DecideDto) {
    const r = await this.getOne(id);
    if (r.status !== RequestStatus.APPROVAL) throw new BadRequestException('Заявка не на согласовании');
    const step = r.chainSteps.find((s) => s.order === r.currentStageIndex);
    if (!step || step.approverId !== user.id) throw new ForbiddenException('Сейчас не ваш этап согласования');

    const isApprove = dto.action === 'approve';
    await this.prisma.$transaction(async (tx) => {
      await tx.requestApprovalStep.update({
        where: { id: step.id },
        data: {
          decision: isApprove ? DecisionAction.APPROVED : DecisionAction.REJECTED,
          decidedAt: new Date(),
          comment: dto.comment ?? null,
        },
      });
      await tx.requestEvent.create({
        data: {
          requestId: r.id,
          action: isApprove ? DecisionAction.APPROVED : DecisionAction.REJECTED,
          byId: user.id,
          byName: user.name,
          stage: step.label,
          comment: dto.comment ?? null,
        },
      });
      if (!isApprove) {
        await tx.request.update({ where: { id: r.id }, data: { status: RequestStatus.REJECTED } });
        return;
      }
      const last = r.currentStageIndex + 1 >= r.chainSteps.length;
      await tx.request.update({
        where: { id: r.id },
        data: last
          ? { status: RequestStatus.SUPPLY, currentStageIndex: r.chainSteps.length }
          : { currentStageIndex: r.currentStageIndex + 1 },
      });
    });
    return this.getOne(id);
  }

  // ── снабжение ──
  async claim(id: string, user: AuthUser) {
    const r = await this.getOne(id);
    if (r.status !== RequestStatus.SUPPLY) throw new BadRequestException('Заявка не в снабжении');
    if (r.assigneeId && r.assigneeId !== user.id && user.role !== Role.ADMIN) {
      // переназначать может только старший снабжения/админ
      const me = await this.prisma.user.findUnique({ where: { id: user.id } });
      if (!me?.isLead) throw new ForbiddenException('Заявка уже взята другим снабженцем');
    }
    return this.prisma.request.update({
      where: { id }, data: { assigneeId: user.id, supplyStage: SupplyStage.INWORK }, include: FULL,
    });
  }

  async setSupplyStage(id: string, stage: SupplyStage) {
    return this.prisma.request.update({ where: { id }, data: { supplyStage: stage }, include: FULL });
  }

  async fulfill(id: string, user: AuthUser) {
    const r = await this.getOne(id);
    if (r.status !== RequestStatus.SUPPLY) throw new BadRequestException('Заявка не в снабжении');
    await this.prisma.requestEvent.create({
      data: { requestId: id, action: DecisionAction.FULFILLED, byId: user.id, byName: user.name },
    });
    // выполнение СВОДНОЙ закрывает исходные заявки (авторы снова их видят и подтверждают получение)
    const cons = await this.prisma.request.findUnique({ where: { id }, include: { consolidatedFrom: true } });
    if (cons?.isConsolidated) {
      for (const s of cons.consolidatedFrom) {
        await this.prisma.request.update({
          where: { id: s.id },
          data: { status: RequestStatus.FULFILLED, postponed: false, consolidatedIntoId: null, wasConsolidated: cons.number },
        });
        await this.prisma.requestItem.updateMany({ where: { requestId: s.id }, data: { fulfilled: true } });
        await this.prisma.requestEvent.create({
          data: { requestId: s.id, action: DecisionAction.FULFILLED, byId: user.id, byName: user.name, comment: `Закуплено в составе сводной ${cons.number} — подтвердите получение` },
        });
      }
    }
    return this.prisma.request.update({ where: { id }, data: { status: RequestStatus.FULFILLED }, include: FULL });
  }

  async confirm(id: string, user: AuthUser) {
    const r = await this.getOne(id);
    if (r.requesterId !== user.id && user.role !== Role.ADMIN) throw new ForbiddenException('Подтвердить может только заявитель');
    if (r.status !== RequestStatus.FULFILLED) throw new BadRequestException('Заявка ещё не выполнена');
    await this.prisma.requestEvent.create({
      data: { requestId: id, action: DecisionAction.CONFIRMED, byId: user.id, byName: user.name },
    });
    return this.prisma.request.update({ where: { id }, data: { status: RequestStatus.DONE }, include: FULL });
  }

  // ── дополнительные действия ──

  async addSupplyNote(id: string, user: AuthUser, text: string) {
    await this.getOne(id);
    await this.prisma.supplyNote.create({ data: { requestId: id, byId: user.id, byName: user.name, text } });
    return this.getOne(id);
  }

  /** склад отмечает наличие позиции (на своём этапе согласования) */
  async setItemStock(id: string, itemId: string, user: AuthUser, status: StockStatus) {
    const r = await this.getOne(id);
    const item = r.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Позиция не найдена');
    await this.prisma.requestItem.update({
      where: { id: itemId },
      data: { stockStatus: status, stockById: user.id, stockByName: user.name, stockAt: new Date() },
    });
    await this.prisma.requestEvent.create({
      data: {
        requestId: id, action: DecisionAction.STOCK, byId: user.id, byName: user.name, stage: 'Склад',
        comment: `${item.name}: ${status === StockStatus.IN ? 'есть на складе' : 'нет на складе'}`,
      },
    });
    return this.getOne(id);
  }

  async setItemFulfilled(id: string, itemId: string, fulfilled: boolean) {
    const r = await this.getOne(id);
    if (!r.items.some((i) => i.id === itemId)) throw new NotFoundException('Позиция не найдена');
    await this.prisma.requestItem.update({ where: { id: itemId }, data: { fulfilled } });
    return this.getOne(id);
  }

  /** старший снабжения / админ назначает исполнителя */
  async assign(id: string, user: AuthUser, assigneeId: string) {
    if (user.role !== Role.ADMIN) {
      const me = await this.prisma.user.findUnique({ where: { id: user.id } });
      if (!me?.isLead) throw new ForbiddenException('Назначать может старший снабжения');
    }
    const target = await this.prisma.user.findUnique({ where: { id: assigneeId } });
    if (!target || target.role !== Role.SUPPLY) throw new BadRequestException('Исполнитель должен быть снабженцем');
    return this.prisma.request.update({
      where: { id }, data: { assigneeId, supplyStage: SupplyStage.INWORK }, include: FULL,
    });
  }

  async setPostponed(id: string, postponed: boolean) {
    return this.prisma.request.update({ where: { id }, data: { postponed }, include: FULL });
  }

  /** заявитель возвращает «выполненную» заявку обратно в снабжение */
  async returnToSupply(id: string, user: AuthUser) {
    const r = await this.getOne(id);
    if (r.requesterId !== user.id && user.role !== Role.ADMIN)
      throw new ForbiddenException('Вернуть может только заявитель');
    if (r.status !== RequestStatus.FULFILLED)
      throw new BadRequestException('Возврат возможен только из статуса «выполнено»');
    await this.prisma.requestEvent.create({
      data: { requestId: id, action: DecisionAction.RETURNED, byId: user.id, byName: user.name },
    });
    return this.prisma.request.update({
      where: { id },
      data: { status: RequestStatus.SUPPLY, supplyStage: SupplyStage.INWORK, postponed: false },
      include: FULL,
    });
  }
}
