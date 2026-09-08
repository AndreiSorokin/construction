import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.department.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } });
  }

  create(organizationId: string, name: string) {
    return this.prisma.department.create({ data: { organizationId, name } });
  }

  private async mustOwn(id: string, organizationId: string) {
    const d = await this.prisma.department.findFirst({ where: { id, organizationId } });
    if (!d) throw new NotFoundException('Отдел не найден');
  }

  async update(id: string, organizationId: string, name: string) {
    await this.mustOwn(id, organizationId);
    return this.prisma.department.update({ where: { id }, data: { name } });
  }

  async remove(id: string, organizationId: string) {
    await this.mustOwn(id, organizationId);
    const [reqs, orders] = await Promise.all([
      this.prisma.request.count({ where: { departmentId: id } }),
      this.prisma.order.count({ where: { departmentId: id } }),
    ]);
    if (reqs || orders) throw new BadRequestException('По отделу есть документы — удаление запрещено');
    await this.prisma.department.delete({ where: { id } });
    return { ok: true };
  }
}
