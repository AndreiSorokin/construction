import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from '../dto/dict.dto';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.catalogItem.findMany({ where: { organizationId }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  create(organizationId: string, dto: CreateCatalogItemDto) {
    return this.prisma.catalogItem.create({ data: { organizationId, name: dto.name, unit: dto.unit, category: dto.category || '' } });
  }

  private async mustOwn(id: string, organizationId: string) {
    const c = await this.prisma.catalogItem.findFirst({ where: { id, organizationId } });
    if (!c) throw new NotFoundException('Позиция не найдена');
  }

  async update(id: string, organizationId: string, dto: UpdateCatalogItemDto) {
    await this.mustOwn(id, organizationId);
    return this.prisma.catalogItem.update({ where: { id }, data: { ...dto } });
  }

  async remove(id: string, organizationId: string) {
    await this.mustOwn(id, organizationId);
    await this.prisma.catalogItem.delete({ where: { id } });
    return { ok: true };
  }
}
