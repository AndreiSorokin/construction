import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateObjectDto, UpdateObjectDto } from '../dto/dict.dto';

@Injectable()
export class ObjectsService {
  constructor(private prisma: PrismaService) {}

  async list(organizationId: string) {
    const rows = await this.prisma.objectSite.findMany({
      where: { organizationId },
      include: { access: { select: { userId: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(({ access, ...o }) => ({ ...o, userIds: access.map((a) => a.userId) }));
  }

  create(organizationId: string, dto: CreateObjectDto) {
    return this.prisma.objectSite.create({
      data: { organizationId, name: dto.name, color: dto.color || 'stone', departmentId: dto.departmentId || null },
    });
  }

  private async mustOwn(id: string, organizationId: string) {
    const o = await this.prisma.objectSite.findFirst({ where: { id, organizationId } });
    if (!o) throw new NotFoundException('Объект не найден');
  }

  async update(id: string, organizationId: string, dto: UpdateObjectDto) {
    await this.mustOwn(id, organizationId);
    return this.prisma.objectSite.update({ where: { id }, data: { ...dto } });
  }

  async remove(id: string, organizationId: string) {
    await this.mustOwn(id, organizationId);
    await this.prisma.objectSite.delete({ where: { id } });
    return { ok: true };
  }

  async setAccess(id: string, organizationId: string, userIds: string[]) {
    await this.mustOwn(id, organizationId);
    const validCount = await this.prisma.user.count({ where: { id: { in: userIds }, organizationId } });
    if (validCount !== userIds.length) throw new NotFoundException('Указан несуществующий пользователь');
    await this.prisma.$transaction([
      this.prisma.objectAccess.deleteMany({ where: { objectId: id } }),
      this.prisma.objectAccess.createMany({ data: userIds.map((userId) => ({ objectId: id, userId })) }),
    ]);
    return { ok: true };
  }
}
