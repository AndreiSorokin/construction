import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.vehicle.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });
  }

  create(organizationId: string, name: string) {
    return this.prisma.vehicle.create({ data: { organizationId, name } });
  }

  private async mustOwn(id: string, organizationId: string) {
    const v = await this.prisma.vehicle.findFirst({ where: { id, organizationId } });
    if (!v) throw new NotFoundException('Техника не найдена');
  }

  async update(id: string, organizationId: string, name: string) {
    await this.mustOwn(id, organizationId);
    return this.prisma.vehicle.update({ where: { id }, data: { name } });
  }

  async remove(id: string, organizationId: string) {
    await this.mustOwn(id, organizationId);
    await this.prisma.vehicle.delete({ where: { id } });
    return { ok: true };
  }
}
