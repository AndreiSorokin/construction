import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.vehicle.findMany({ orderBy: { name: 'asc' } });
  }

  create(name: string) {
    return this.prisma.vehicle.create({ data: { name } });
  }

  update(id: string, name: string) {
    return this.prisma.vehicle.update({ where: { id }, data: { name } });
  }

  async remove(id: string) {
    await this.prisma.vehicle.delete({ where: { id } });
    return { ok: true };
  }
}
