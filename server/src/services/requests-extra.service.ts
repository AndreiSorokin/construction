import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DecisionAction, Prisma, Priority, RequestStatus, Role, SupplyStage } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { MailService } from './mail.service';
import { FilesService } from './files.service';
import { AuthUser } from '../decorators/current-user.decorator';
import { ConsolidateDto, EditRequestDto, ItemPatchDto } from '../dto/request-extra.dto';
import { FULL, withLiveConsolidatedItems } from './requests.service';

const ITEM_TYPES = new Set(['TMC', 'QUARRY', 'FUEL']); // типы «с позициями» — только их можно объединять
const TYPE_RU: Record<string, string> = { TMC: 'ТМЦ', QUARRY: 'Карьер', FUEL: 'ГСМ' };

@Injectable()
export class RequestsExtraService {
  constructor(private prisma: PrismaService, private mail: MailService, private files: FilesService) {}

  private async getOne(id: string, organizationId: string) {
    const r = await this.prisma.request.findFirst({ where: { id, organizationId }, include: FULL });
    if (!r) throw new NotFoundException('Заявка не найдена');
    return withLiveConsolidatedItems(r);
  }

  private isSupply(u: AuthUser) { return u.role === Role.SUPPLY || u.role === Role.ADMIN; }

  private canEdit(r: Awaited<ReturnType<RequestsExtraService['getOne']>>, u: AuthUser) {
    if (u.role === Role.ADMIN) return true;
    const isCurrentApprover =
      r.status === RequestStatus.APPROVAL &&
      r.chainSteps.some((s) => s.order === r.currentStageIndex && s.approverId === u.id);
    if (isCurrentApprover) return true;
    const noDecisions = r.chainSteps.every((s) => !s.decision);
    return r.requesterId === u.id && r.status === RequestStatus.APPROVAL && noDecisions;
  }

  /** человекочитаемое описание правки — что именно поменялось, для истории заявки */
  private describeEdit(r: Awaited<ReturnType<RequestsExtraService['getOne']>>, dto: EditRequestDto): string | null {
    const changes: string[] = [];
    if (dto.note !== undefined && (dto.note ?? '') !== (r.note ?? '')) changes.push('примечание');
    if (dto.due !== undefined) {
      const newDue = dto.due ? new Date(dto.due).getTime() : null;
      const oldDue = r.due ? r.due.getTime() : null;
      if (newDue !== oldDue) changes.push('срок');
    }
    if (dto.objectId !== undefined && (dto.objectId || null) !== (r.objectId || null)) changes.push('объект');
    if (dto.fields !== undefined && JSON.stringify(dto.fields) !== JSON.stringify(r.fields)) changes.push('поля');
    if (dto.items) {
      const added = dto.items.filter((i) => !i.id).length;
      const removed = r.items.filter((old) => !dto.items!.some((i) => i.id === old.id)).length;
      const modified = dto.items.filter((i) => {
        if (!i.id) return false;
        const old = r.items.find((o) => o.id === i.id);
        return !!old && (old.name !== i.name || old.unit !== i.unit || (old.qty || '') !== (i.qty || '') || (old.note || '') !== (i.note || ''));
      }).length;
      const parts = [added && `+${added}`, removed && `-${removed}`, modified && `~${modified}`].filter(Boolean);
      if (parts.length) changes.push(`позиции (${parts.join(', ')})`);
    }
    return changes.length ? `Изменено: ${changes.join(', ')}` : null;
  }

  /** правка состава/полей; «получено N» (deliveredQty) у существующих позиций НЕ трогаем */
  async edit(id: string, u: AuthUser, dto: EditRequestDto) {
    const r = await this.getOne(id, u.orgId);
    if (!this.canEdit(r, u)) throw new ForbiddenException('Сейчас заявку править нельзя');
    const editSummary = this.describeEdit(r, dto);
    await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id },
        data: {
          note: dto.note ?? r.note,
          due: dto.due === undefined ? r.due : dto.due ? new Date(dto.due) : null,
          objectId: dto.objectId === undefined ? r.objectId : dto.objectId || null,
          fields: (dto.fields ?? (r.fields as any)) as Prisma.InputJsonValue,
        },
      });
      if (dto.items) {
        const keep = new Set(dto.items.filter((i) => i.id).map((i) => i.id as string));
        await tx.requestItem.deleteMany({ where: { requestId: id, id: { notIn: [...keep] } } });
        for (const it of dto.items) {
          if (it.id) {
            await tx.requestItem.update({
              where: { id: it.id },
              data: { name: it.name, unit: it.unit, qty: it.qty ?? '', note: it.note ?? '' },
            });
          } else {
            await tx.requestItem.create({
              data: { requestId: id, name: it.name, unit: it.unit, qty: it.qty ?? '', note: it.note ?? '' },
            });
          }
        }
      }
      await tx.requestEvent.create({
        data: { requestId: id, action: DecisionAction.EDITED, byId: u.id, byName: u.name, comment: dto.comment || editSummary },
      });
    });
    return this.getOne(id, u.orgId);
  }

  /** повторная подача после «возвращено»/«отклонено»: маршрут с нуля, решения сброшены */
  async resubmit(id: string, u: AuthUser) {
    const r = await this.getOne(id, u.orgId);
    if (r.requesterId !== u.id && u.role !== Role.ADMIN) throw new ForbiddenException('Повторно подать может автор');
    if (r.status !== RequestStatus.REJECTED) throw new BadRequestException('Повторная подача — только для отклонённых');
    await this.prisma.$transaction(async (tx) => {
      await tx.requestApprovalStep.updateMany({
        where: { requestId: id }, data: { decision: null, decidedAt: null, comment: null },
      });
      const hasChain = r.chainSteps.length > 0;
      await tx.request.update({
        where: { id },
        data: { status: hasChain ? RequestStatus.APPROVAL : RequestStatus.SUPPLY, currentStageIndex: 0 },
      });
      await tx.requestEvent.create({
        data: { requestId: id, action: DecisionAction.RESUBMITTED, byId: u.id, byName: u.name, comment: 'Отправлена повторно после доработки' },
      });
    });
    const first = r.chainSteps[0];
    if (first) {
      const appr = await this.prisma.user.findUnique({ where: { id: first.approverId } });
      if (appr?.email) this.mail.notifyApprovalNeeded(appr.email, appr.name, r.number, `/requests/${id}`).catch(() => undefined);
    }
    return this.getOne(id, u.orgId);
  }

  /** отзыв автором в черновик — доступно на APPROVAL/SUPPLY, только самому автору (без обхода для
   *  ADMIN). Заявка удаляется целиком (каскадно уносит позиции/маршрут/историю/вложения) —
   *  это и есть «сброс маршрута согласования»: при повторной подаче из черновика он строится
   *  заново с нуля в create(). */
  async withdraw(id: string, u: AuthUser) {
    const r = await this.getOne(id, u.orgId);
    if (r.requesterId !== u.id) throw new ForbiddenException('Отозвать может только автор заявки');
    if (r.status !== RequestStatus.APPROVAL && r.status !== RequestStatus.SUPPLY) {
      throw new BadRequestException('Отзыв недоступен для этого статуса');
    }
    const existing = await this.prisma.draft.findUnique({ where: { userId_type: { userId: u.id, type: r.type } } });
    if (existing) {
      throw new BadRequestException('У вас уже есть незавершённый черновик этого же типа заявки — сначала подайте его или удалите в разделе «Черновики»');
    }
    const payload = {
      note: r.note, due: r.due ? r.due.toISOString().slice(0, 10) : '',
      priority: r.priority, objectId: r.objectId || '', departmentId: r.departmentId,
      items: (r.items || []).map((i: any) => ({ name: i.name, unit: i.unit, qty: i.qty, note: i.note })),
      fields: r.fields,
    };
    await this.prisma.draft.create({ data: { userId: u.id, type: r.type, payload } });
    for (const att of r.attachments || []) {
      await this.files.remove(att.key).catch(() => undefined); // best-effort — не блокируем отзыв из-за S3
    }
    await this.prisma.request.delete({ where: { id } });
    return { ok: true };
  }

  async setPriority(id: string, u: AuthUser, priority: Priority) {
    if (!this.isSupply(u)) throw new ForbiddenException('Приоритет меняет снабжение или админ');
    await this.getOne(id, u.orgId);
    return this.prisma.request.update({ where: { id }, data: { priority }, include: FULL });
  }

  async setDue(id: string, u: AuthUser, due: string | null) {
    if (!this.isSupply(u)) throw new ForbiddenException('Срок меняет снабжение или админ');
    await this.getOne(id, u.orgId);
    return this.prisma.request.update({ where: { id }, data: { due: due ? new Date(due) : null }, include: FULL });
  }

  /** снять заявку с себя (или админ/старший — с любого) */
  async release(id: string, u: AuthUser) {
    const r = await this.getOne(id, u.orgId);
    if (r.assigneeId !== u.id && u.role !== Role.ADMIN) {
      const me = await this.prisma.user.findUnique({ where: { id: u.id } });
      if (!me?.isLead) throw new ForbiddenException('Снять может исполнитель, старший или админ');
    }
    return this.prisma.request.update({
      where: { id }, data: { assigneeId: null, supplyStage: SupplyStage.NEW }, include: FULL,
    });
  }

  /** позиция: «получено N», срок поставки, правка наименования/ед./кол-ва (снабжение/админ) */
  async patchItem(id: string, itemId: string, u: AuthUser, dto: ItemPatchDto) {
    if (!this.isSupply(u)) throw new ForbiddenException('Позиции в снабжении меняет снабжение или админ');
    const r = await this.getOne(id, u.orgId);
    if (!r.items.some((i) => i.id === itemId)) throw new NotFoundException('Позиция не найдена');
    await this.prisma.requestItem.update({
      where: { id: itemId },
      data: {
        ...(dto.deliveredQty !== undefined ? { deliveredQty: String(dto.deliveredQty ?? '') } : {}),
        ...(dto.eta !== undefined ? { eta: dto.eta ? new Date(dto.eta) : null } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
        ...(dto.qty !== undefined ? { qty: dto.qty } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
    });
    return this.getOne(id, u.orgId);
  }

  async setSpent(id: string, u: AuthUser, spent: number | null) {
    if (!this.isSupply(u)) throw new ForbiddenException('Сумму вносит снабжение или админ');
    await this.getOne(id, u.orgId);
    return this.prisma.request.update({
      where: { id }, data: { spent: spent == null ? null : new Prisma.Decimal(spent) }, include: FULL,
    });
  }

  // ── объединение заявок (сводные СВ-####) ──

  private async nextConsNumber(organizationId: string): Promise<string> {
    const c = await this.prisma.counter.upsert({
      where: { organizationId_key: { organizationId, key: 'req:CONS' } },
      create: { organizationId, key: 'req:CONS', value: 1 },
      update: { value: { increment: 1 } },
    });
    return `СВ-${String(c.value).padStart(4, '0')}`;
  }

  async consolidate(u: AuthUser, dto: ConsolidateDto) {
    if (!this.isSupply(u)) throw new ForbiddenException('Объединяет снабжение или админ');
    const src = await this.prisma.request.findMany({
      where: { id: { in: dto.ids }, organizationId: u.orgId }, include: { items: true },
    });
    const good = src.filter(
      (r) => ITEM_TYPES.has(r.type) && r.status === RequestStatus.SUPPLY && !r.isConsolidated && !r.consolidatedIntoId,
    );
    if (good.length < 2) {
      throw new BadRequestException('Для объединения выберите минимум две активные заявки с позициями (не входящие в другую сводную)');
    }
    const types = new Set(good.map((r) => r.type));
    if (types.size > 1) {
      throw new BadRequestException(
        `Нельзя объединять заявки разных типов (${[...types].map((t) => TYPE_RU[t] || t).join(', ')}) — выберите заявки одного типа`,
      );
    }
    const number = await this.nextConsNumber(u.orgId);
    // агрегируем позиции по «наименование + единица», храня ссылки на источники
    const agg = new Map<string, { name: string; unit: string; qty: number; srcRefs: { requestId: string; itemId: string }[] }>();
    for (const r of good) {
      for (const it of r.items) {
        const key = `${it.name.trim().toLowerCase()}|${it.unit.trim().toLowerCase()}`;
        const cur = agg.get(key) || { name: it.name, unit: it.unit, qty: 0, srcRefs: [] };
        cur.qty += Number(String(it.qty).replace(',', '.').replace(/[^\d.]/g, '')) || 0;
        cur.srcRefs.push({ requestId: r.id, itemId: it.id });
        agg.set(key, cur);
      }
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const cons = await tx.request.create({
        data: {
          organizationId: u.orgId,
          number,
          type: good[0].type,
          departmentId: good[0].departmentId,
          requesterId: u.id,
          status: RequestStatus.SUPPLY,
          isConsolidated: true,
          // без назначения — сводная, как и любая новая заявка в снабжении, попадает
          // в общий пул «Входящие», а не сразу «в мои» у того, кто её собрал
          note: `Сводная из: ${good.map((g) => g.number).join(', ')}`,
          items: {
            create: [...agg.values()].map((a) => ({
              name: a.name, unit: a.unit, qty: a.qty ? String(a.qty) : '',
              srcRefs: a.srcRefs as unknown as Prisma.InputJsonValue,
            })),
          },
          events: { create: { action: DecisionAction.CREATED, byId: u.id, byName: u.name, comment: 'Сводная заявка' } },
        },
      });
      for (const r of good) {
        await tx.request.update({ where: { id: r.id }, data: { consolidatedIntoId: cons.id, postponed: true } });
        await tx.requestEvent.create({
          data: { requestId: r.id, action: DecisionAction.CONSOLIDATED, byId: u.id, byName: u.name, comment: `Включена в сводную ${number}` },
        });
      }
      return cons;
    });
    return this.getOne(created.id, u.orgId);
  }

  /** разъединение: файлы сводной переносятся в ПЕРВУЮ исходную; сводная с файлами/суммой — в архив */
  async unconsolidate(id: string, u: AuthUser) {
    if (!this.isSupply(u)) throw new ForbiddenException('Разъединяет снабжение или админ');
    const c = await this.prisma.request.findFirst({
      where: { id, organizationId: u.orgId }, include: { items: true, attachments: true, consolidatedFrom: { orderBy: { createdAt: 'asc' } } },
    });
    if (!c) throw new NotFoundException('Заявка не найдена');
    if (!c.isConsolidated) throw new BadRequestException('Это не сводная заявка');
    const sources = c.consolidatedFrom;
    const first = sources[0];
    // позиции, закрытые в сводной, отмечаем полученными в источниках
    const doneRefs: { requestId: string; itemId: string }[] = [];
    for (const it of c.items) {
      if (it.fulfilled && Array.isArray(it.srcRefs)) doneRefs.push(...(it.srcRefs as any[]));
    }
    const keep = c.attachments.length > 0 || c.spent != null;
    await this.prisma.$transaction(async (tx) => {
      if (first && c.attachments.length > 0) {
        await tx.attachment.updateMany({
          where: { requestId: c.id },
          data: { requestId: first.id, fromConsolidated: c.number },
        });
      }
      for (const s of sources) {
        await tx.request.update({ where: { id: s.id }, data: { consolidatedIntoId: null, postponed: false } });
        const moved = first && s.id === first.id && c.attachments.length > 0
          ? ` · файлы сводной (${c.attachments.length}) перенесены сюда` : '';
        await tx.requestEvent.create({
          data: { requestId: s.id, action: DecisionAction.UNCONSOLIDATED, byId: u.id, byName: u.name, comment: `${c.number} расформирована${moved}` },
        });
      }
      for (const ref of doneRefs) {
        await tx.requestItem.updateMany({ where: { id: ref.itemId, requestId: ref.requestId }, data: { fulfilled: true } });
      }
      if (keep) {
        await tx.request.update({
          where: { id: c.id },
          data: { status: RequestStatus.REJECTED, note: `${c.note} · Расформирована; файлы перенесены в ${first ? first.number : 'исходную заявку'}` },
        });
        await tx.requestEvent.create({
          data: { requestId: c.id, action: DecisionAction.UNCONSOLIDATED, byId: u.id, byName: u.name, comment: 'Сводная расформирована; позиции возвращены в исходные заявки' },
        });
      } else {
        await tx.request.delete({ where: { id: c.id } });
      }
    });
    return { ok: true, movedTo: first ? first.number : null };
  }
}
