import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateIpDto, UpdateIpDto } from '../dto/dict.dto';

@Injectable()
export class IpsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.ip.findMany({ orderBy: { name: 'asc' } });
  }

  create(dto: CreateIpDto) {
    return this.prisma.ip.create({ data: { name: dto.name, bin: dto.bin || null, vat: dto.vat ?? true } });
  }

  update(id: string, dto: UpdateIpDto) {
    return this.prisma.ip.update({ where: { id }, data: { ...dto } });
  }

  async remove(id: string) {
    await this.prisma.ip.delete({ where: { id } });
    return { ok: true };
  }
}
