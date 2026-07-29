import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

const PUB_USER = {
  id: true, login: true, name: true, role: true, departmentId: true,
  isLead: true, ordersAccess: true, isActive: true, email: true,
} as const;

@Injectable()
export class MetaService {
  constructor(private prisma: PrismaService) {}

  /** все справочные данные для интерфейса одним вызовом */
  async bootstrap(userId: string) {
    const [me, users, departments, objectsRaw, catalogItems, workCatalogs, ips, supplySteps, orderSteps] =
      await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId }, select: PUB_USER }),
        this.prisma.user.findMany({ select: PUB_USER, orderBy: { createdAt: 'asc' } }),
        this.prisma.department.findMany({ orderBy: { createdAt: 'asc' } }),
        this.prisma.objectSite.findMany({ include: { access: { select: { userId: true } } }, orderBy: { createdAt: 'asc' } }),
        this.prisma.catalogItem.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
        this.prisma.workCatalog.findMany({ include: { items: { orderBy: { name: 'asc' } } }, orderBy: { name: 'asc' } }),
        this.prisma.ip.findMany({ orderBy: { name: 'asc' } }),
        this.prisma.supplyChainStep.findMany({ orderBy: [{ departmentId: 'asc' }, { type: 'asc' }, { order: 'asc' }] }),
        this.prisma.orderChainStep.findMany({ orderBy: [{ departmentId: 'asc' }, { order: 'asc' }] }),
      ]);
    const objects = objectsRaw.map(({ access, ...o }) => ({ ...o, userIds: access.map((a) => a.userId) }));
    return { me, users, departments, objects, catalogItems, workCatalogs, ips, supplySteps, orderSteps };
  }
}
