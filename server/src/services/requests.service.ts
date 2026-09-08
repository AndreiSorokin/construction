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
  // id (cuid) растёт по времени создания — без orderBy Postgres может вернуть позиции в другом
  // порядке после UPDATE (строка физически переписывается), из-за чего отмеченная позиция
  // визуально «прыгала» в списке; сортировка по id держит порядок стабильным
  items: { orderBy: { id: 'asc' as const } },
  chainSteps: { orderBy: { order: 'asc' as const } },
  events: { orderBy: { at: 'asc' as const } },
  supplyNotes: { orderBy: { at: 'asc' as const } },
  attachments: true,
  // исходные заявки сводной — полный набор, чтобы на странице сводной было видно то же самое,
  // что было бы видно на странице каждой исходной заявки по отдельности
  consolidatedFrom: {
    include: {
      items: { orderBy: { id: 'asc' as const } },
      chainSteps: { orderBy: { order: 'asc' as const } },
      supplyNotes: { orderBy: { at: 'asc' as const } },
      attachments: true,
    },
  },
};

const parseQty = (v: unknown) => Number(String(v ?? '').replace(',', '.').replace(/[^\d.]/g, '')) || 0;

/**
 * Позиции сводной заявки — это отдельные строки, но никакого своего состояния они не хранят
 * по сути: сводная только собирает и показывает реальное положение дел по исходным заявкам.
 * Всё (название/ед.изм./кол-во/примечание/получено/наличие/срок/выполнено) при каждом чтении
 * пересчитывается из текущего состояния исходных позиций (по srcRefs) — правки в ТМЦ-1/ТМЦ-2
 * видно в СВ-1 сразу. Редактирование самих позиций происходит только на стороне источников
 * (см. секцию «Из исходных заявок» на клиенте) — если позиция собрана из нескольких исходных
 * с одинаковым названием+ед.изм., у одной строки СВ несколько источников и правка «какого именно»
 * поля на самой сводной была бы неоднозначна.
 */
export function withLiveConsolidatedItems<T extends { isConsolidated: boolean; items: any[]; consolidatedFrom?: any[] }>(r: T): T {
  if (!r.isConsolidated || !r.items?.length) return r;
  const bySourceItemId = new Map<string, any>();
  for (const src of r.consolidatedFrom || []) {
    for (const it of src.items || []) bySourceItemId.set(it.id, it);
  }
  r.items = r.items.map((it: any) => {
    const refs: { requestId: string; itemId: string }[] = Array.isArray(it.srcRefs) ? it.srcRefs : [];
    if (refs.length === 0) return it;
    const live = refs.map((ref) => bySourceItemId.get(ref.itemId)).filter(Boolean);
    if (live.length === 0) return it; // источники были разъединены/удалены — оставляем как есть
    const qtySum = live.reduce((sum: number, l: any) => sum + parseQty(l.qty), 0);
    const deliveredSum = live.reduce((sum: number, l: any) => sum + parseQty(l.deliveredQty), 0);
    const notes = [...new Set(live.map((l: any) => l.note).filter(Boolean))];
    const etas = live.map((l: any) => l.eta).filter(Boolean).sort();
    return {
      ...it,
      name: live[0].name,
      unit: live[0].unit,
      note: notes.join('; '),
      qty: qtySum ? String(qtySum) : '',
      deliveredQty: deliveredSum ? String(deliveredSum) : '',
      eta: etas[0] || null, // ближайший срок среди источников
      fulfilled: live.every((l: any) => l.fulfilled), // выполнено, только если выполнены ВСЕ источники
      stockStatus: live.some((l: any) => l.stockStatus === 'OUT') ? 'OUT' : live.every((l: any) => l.stockStatus === 'IN') ? 'IN' : null,
    };
  });
  return r;
}

@Injectable()
export class RequestsService {
  constructor(private prisma: PrismaService, private mail: MailService) {}

  private async nextNumber(organizationId: string, type: RequestType): Promise<string> {
    const key = `req:${type}`;
    const c = await this.prisma.counter.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: { organizationId, key, value: 1 },
      update: { value: { increment: 1 } },
    });
    return `${PREFIX[type]}-${String(c.value).padStart(4, '0')}`;
  }

  async create(dto: CreateRequestDto, user: AuthUser) {
    const dept = await this.prisma.department.findFirst({ where: { id: dto.departmentId, organizationId: user.orgId } });
    if (!dept) throw new BadRequestException('Отдел не найден');
    if (dto.objectId) {
      const obj = await this.prisma.objectSite.findFirst({ where: { id: dto.objectId, organizationId: user.orgId } });
      if (!obj) throw new BadRequestException('Объект не найден');
    }
    // снапшот маршрута согласования для отдела+типа
    const steps = await this.prisma.supplyChainStep.findMany({
      where: { departmentId: dto.departmentId, type: dto.type },
      orderBy: { order: 'asc' },
    });
    const approverIds = steps.map((s) => s.approverId);
    const approvers = await this.prisma.user.findMany({ where: { id: { in: approverIds } } });
    const nameOf = (id: string) => approvers.find((a) => a.id === id);

    const number = await this.nextNumber(user.orgId, dto.type);
    const hasChain = steps.length > 0;

    // лимит «Срочно» в день: при исчерпании приоритет тихо понижается до «Высокий» с записью в историю
    let priority = dto.priority ?? Priority.NORMAL;
    let downgraded = false;
    if (priority === Priority.URGENT) {
      const setting = await this.prisma.appSetting.upsert({
        where: { organizationId: user.orgId }, create: { organizationId: user.orgId }, update: {},
      });
      if (setting.urgentLimit > 0) {
        const from = new Date(); from.setHours(0, 0, 0, 0);
        const todayUrgent = await this.prisma.request.count({ where: { organizationId: user.orgId, priority: Priority.URGENT, createdAt: { gte: from } } });
        if (todayUrgent >= setting.urgentLimit) { priority = Priority.HIGH; downgraded = true; }
      }
    }

    const created = await this.prisma.request.create({
      data: {
        organizationId: user.orgId,
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
    const base: Prisma.RequestWhereInput = { organizationId: user.orgId };
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
    }).then((rows) => rows.map(withLiveConsolidatedItems));
  }

  async getOne(id: string, organizationId: string) {
    const r = await this.prisma.request.findFirst({ where: { id, organizationId }, include: FULL });
    if (!r) throw new NotFoundException('Заявка не найдена');
    return withLiveConsolidatedItems(r);
  }

  async decide(id: string, user: AuthUser, dto: DecideDto) {
    const r = await this.getOne(id, user.orgId);
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
    return this.getOne(id, user.orgId);
  }

  // ── снабжение ──
  async claim(id: string, user: AuthUser) {
    const r = await this.getOne(id, user.orgId);
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

  async setSupplyStage(id: string, organizationId: string, stage: SupplyStage) {
    await this.getOne(id, organizationId);
    return this.prisma.request.update({ where: { id }, data: { supplyStage: stage }, include: FULL });
  }

  async fulfill(id: string, user: AuthUser) {
    const r = await this.getOne(id, user.orgId);
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
    const r = await this.getOne(id, user.orgId);
    if (r.requesterId !== user.id && user.role !== Role.ADMIN) throw new ForbiddenException('Подтвердить может только заявитель');
    if (r.status !== RequestStatus.FULFILLED) throw new BadRequestException('Заявка ещё не выполнена');
    await this.prisma.requestEvent.create({
      data: { requestId: id, action: DecisionAction.CONFIRMED, byId: user.id, byName: user.name },
    });
    return this.prisma.request.update({ where: { id }, data: { status: RequestStatus.DONE }, include: FULL });
  }

  // ── дополнительные действия ──

  async addSupplyNote(id: string, user: AuthUser, text: string) {
    await this.getOne(id, user.orgId);
    await this.prisma.supplyNote.create({ data: { requestId: id, byId: user.id, byName: user.name, text } });
    return this.getOne(id, user.orgId);
  }

  /** склад отмечает наличие позиции (на своём этапе согласования) */
  async setItemStock(id: string, itemId: string, user: AuthUser, status: StockStatus) {
    const r = await this.getOne(id, user.orgId);
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
    return this.getOne(id, user.orgId);
  }

  async setItemFulfilled(id: string, organizationId: string, itemId: string, fulfilled: boolean) {
    const r = await this.getOne(id, organizationId);
    if (!r.items.some((i) => i.id === itemId)) throw new NotFoundException('Позиция не найдена');
    await this.prisma.requestItem.update({ where: { id: itemId }, data: { fulfilled } });
    return this.getOne(id, organizationId);
  }

  /** старший снабжения / админ назначает исполнителя */
  async assign(id: string, user: AuthUser, assigneeId: string) {
    await this.getOne(id, user.orgId);
    if (user.role !== Role.ADMIN) {
      const me = await this.prisma.user.findUnique({ where: { id: user.id } });
      if (!me?.isLead) throw new ForbiddenException('Назначать может старший снабжения');
    }
    const target = await this.prisma.user.findFirst({ where: { id: assigneeId, organizationId: user.orgId } });
    if (!target || target.role !== Role.SUPPLY) throw new BadRequestException('Исполнитель должен быть снабженцем');
    return this.prisma.request.update({
      where: { id }, data: { assigneeId, supplyStage: SupplyStage.INWORK }, include: FULL,
    });
  }

  async setPostponed(id: string, organizationId: string, postponed: boolean) {
    await this.getOne(id, organizationId);
    return this.prisma.request.update({ where: { id }, data: { postponed }, include: FULL });
  }

  /** заявитель возвращает «выполненную» заявку обратно в снабжение */
  async returnToSupply(id: string, user: AuthUser) {
    const r = await this.getOne(id, user.orgId);
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
