import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from '../dto/dict.dto';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.catalogItem.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  create(dto: CreateCatalogItemDto) {
    return this.prisma.catalogItem.create({ data: { name: dto.name, unit: dto.unit, category: dto.category || '' } });
  }

  update(id: string, dto: UpdateCatalogItemDto) {
    return this.prisma.catalogItem.update({ where: { id }, data: { ...dto } });
  }

  async remove(id: string) {
    await this.prisma.catalogItem.delete({ where: { id } });
    return { ok: true };
  }
}
