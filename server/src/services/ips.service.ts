import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateIpDto, UpdateIpDto } from '../dto/dict.dto';

@Injectable()
export class IpsService {
  constructor(private prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.ip.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });
  }

  create(organizationId: string, dto: CreateIpDto) {
    return this.prisma.ip.create({ data: { organizationId, name: dto.name, bin: dto.bin || null, vat: dto.vat ?? true } });
  }

  private async mustOwn(id: string, organizationId: string) {
    const ip = await this.prisma.ip.findFirst({ where: { id, organizationId } });
    if (!ip) throw new NotFoundException('ИП не найден');
  }

  async update(id: string, organizationId: string, dto: UpdateIpDto) {
    await this.mustOwn(id, organizationId);
    return this.prisma.ip.update({ where: { id }, data: { ...dto } });
  }

  async remove(id: string, organizationId: string) {
    await this.mustOwn(id, organizationId);
    await this.prisma.ip.delete({ where: { id } });
    return { ok: true };
  }
}
