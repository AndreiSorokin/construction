import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.department.findMany({ orderBy: { createdAt: 'asc' } });
  }

  create(organizationId: string, name: string) {
    return this.prisma.department.create({ data: { organizationId, name } });
  }

  update(id: string, name: string) {
    return this.prisma.department.update({ where: { id }, data: { name } });
  }

  async remove(id: string) {
    const [reqs, orders] = await Promise.all([
      this.prisma.request.count({ where: { departmentId: id } }),
      this.prisma.order.count({ where: { departmentId: id } }),
    ]);
    if (reqs || orders) throw new BadRequestException('По отделу есть документы — удаление запрещено');
    await this.prisma.department.delete({ where: { id } });
    return { ok: true };
  }
}
