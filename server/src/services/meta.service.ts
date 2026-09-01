import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

const PUB_USER = {
  id: true, login: true, name: true, role: true, departmentId: true,
  isLead: true, ordersAccess: true, canPrice: true, isActive: true, email: true, theme: true,
} as const;

@Injectable()
export class MetaService {
  constructor(private prisma: PrismaService) {}

  /** все справочные данные для интерфейса одним вызовом */
  async bootstrap(organizationId: string, userId: string) {
    const [organization, me, users, departments, objectsRaw, catalogItems, workCatalogs, ips, vehicles, supplySteps, orderSteps] =
      await Promise.all([
        this.prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, slug: true } }),
        this.prisma.user.findUnique({ where: { id: userId }, select: PUB_USER }),
        this.prisma.user.findMany({ where: { organizationId }, select: PUB_USER, orderBy: { createdAt: 'asc' } }),
        this.prisma.department.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } }),
        this.prisma.objectSite.findMany({ include: { access: { select: { userId: true } } }, orderBy: { createdAt: 'asc' } }),
        this.prisma.catalogItem.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
        this.prisma.workCatalog.findMany({ include: { items: { orderBy: { name: 'asc' } } }, orderBy: { name: 'asc' } }),
        this.prisma.ip.findMany({ orderBy: { name: 'asc' } }),
        this.prisma.vehicle.findMany({ orderBy: { name: 'asc' } }),
        this.prisma.supplyChainStep.findMany({ orderBy: [{ departmentId: 'asc' }, { type: 'asc' }, { order: 'asc' }] }),
        this.prisma.orderChainStep.findMany({ orderBy: [{ departmentId: 'asc' }, { order: 'asc' }] }),
      ]);
    const objects = objectsRaw.map(({ access, ...o }) => ({ ...o, userIds: access.map((a) => a.userId) }));
    return { organization, me, users, departments, objects, catalogItems, workCatalogs, ips, vehicles, supplySteps, orderSteps };
  }
}
