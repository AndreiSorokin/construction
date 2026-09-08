import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  CreateWorkCatalogDto, ImportWorksDto, UpdateWorkCatalogDto, UpdateWorkItemDto, WorkItemDto,
} from '../dto/work.dto';

const WITH_ITEMS = { items: { orderBy: { name: 'asc' as const } } };

@Injectable()
export class WorkCatalogsService {
  constructor(private prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.workCatalog.findMany({ where: { organizationId }, include: WITH_ITEMS, orderBy: { name: 'asc' } });
  }

  create(organizationId: string, dto: CreateWorkCatalogDto) {
    return this.prisma.workCatalog.create({ data: { organizationId, name: dto.name, kind: dto.kind }, include: WITH_ITEMS });
  }

  async update(id: string, organizationId: string, dto: UpdateWorkCatalogDto) {
    await this.mustExist(id, organizationId);
    return this.prisma.workCatalog.update({ where: { id }, data: { ...dto }, include: WITH_ITEMS });
  }

  async remove(id: string, organizationId: string) {
    await this.mustExist(id, organizationId);
    await this.prisma.workCatalog.delete({ where: { id } });
    return { ok: true };
  }

  private async mustExist(id: string, organizationId: string) {
    const c = await this.prisma.workCatalog.findFirst({ where: { id, organizationId } });
    if (!c) throw new NotFoundException('Справочник не найден');
  }

  async addItem(catalogId: string, organizationId: string, dto: WorkItemDto) {
    await this.mustExist(catalogId, organizationId);
    return this.prisma.workItem.create({
      data: { catalogId, name: dto.name, unit: dto.unit, price: String(dto.price) },
    });
  }

  async updateItem(catalogId: string, organizationId: string, itemId: string, dto: UpdateWorkItemDto) {
    await this.mustExist(catalogId, organizationId);
    const { price, ...rest } = dto;
    const res = await this.prisma.workItem.updateMany({
      where: { id: itemId, catalogId },
      data: { ...rest, ...(price !== undefined ? { price: String(price) } : {}) },
    });
    if (res.count === 0) throw new NotFoundException('Работа не найдена');
    return this.prisma.workItem.findUnique({ where: { id: itemId } });
  }

  async removeItem(catalogId: string, organizationId: string, itemId: string) {
    await this.mustExist(catalogId, organizationId);
    await this.prisma.workItem.deleteMany({ where: { id: itemId, catalogId } });
    return { ok: true };
  }

  /** импорт списка работ (JSON/CSV разбирает клиент; сюда приходит массив) */
  async import(catalogId: string, organizationId: string, dto: ImportWorksDto) {
    await this.mustExist(catalogId, organizationId);
    await this.prisma.$transaction(async (tx) => {
      if (dto.mode === 'replace') await tx.workItem.deleteMany({ where: { catalogId } });
      await tx.workItem.createMany({
        data: dto.items.map((i) => ({
          catalogId, name: i.name, unit: i.unit, price: String(i.price),
        })),
      });
    });
    return this.prisma.workCatalog.findUnique({ where: { id: catalogId }, include: WITH_ITEMS });
  }
}
