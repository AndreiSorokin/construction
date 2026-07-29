import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  CreateWorkCatalogDto, ImportWorksDto, UpdateWorkCatalogDto, UpdateWorkItemDto, WorkItemDto,
} from '../dto/work.dto';

const WITH_ITEMS = { items: { orderBy: { name: 'asc' as const } } };

@Injectable()
export class WorkCatalogsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.workCatalog.findMany({ include: WITH_ITEMS, orderBy: { name: 'asc' } });
  }

  create(dto: CreateWorkCatalogDto) {
    return this.prisma.workCatalog.create({ data: { name: dto.name, kind: dto.kind }, include: WITH_ITEMS });
  }

  update(id: string, dto: UpdateWorkCatalogDto) {
    return this.prisma.workCatalog.update({ where: { id }, data: { ...dto }, include: WITH_ITEMS });
  }

  async remove(id: string) {
    await this.prisma.workCatalog.delete({ where: { id } });
    return { ok: true };
  }

  private async mustExist(id: string) {
    const c = await this.prisma.workCatalog.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Справочник не найден');
  }

  async addItem(catalogId: string, dto: WorkItemDto) {
    await this.mustExist(catalogId);
    return this.prisma.workItem.create({
      data: { catalogId, name: dto.name, unit: dto.unit, price: String(dto.price), dsu: dto.dsu ?? null },
    });
  }

  updateItem(itemId: string, dto: UpdateWorkItemDto) {
    const { price, ...rest } = dto;
    return this.prisma.workItem.update({
      where: { id: itemId },
      data: { ...rest, ...(price !== undefined ? { price: String(price) } : {}) },
    });
  }

  async removeItem(itemId: string) {
    await this.prisma.workItem.delete({ where: { id: itemId } });
    return { ok: true };
  }

  /** импорт списка работ (JSON/CSV разбирает клиент; сюда приходит массив) */
  async import(catalogId: string, dto: ImportWorksDto) {
    await this.mustExist(catalogId);
    await this.prisma.$transaction(async (tx) => {
      if (dto.mode === 'replace') await tx.workItem.deleteMany({ where: { catalogId } });
      await tx.workItem.createMany({
        data: dto.items.map((i) => ({
          catalogId, name: i.name, unit: i.unit, price: String(i.price), dsu: i.dsu ?? null,
        })),
      });
    });
    return this.prisma.workCatalog.findUnique({ where: { id: catalogId }, include: WITH_ITEMS });
  }
}
