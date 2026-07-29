import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateObjectDto, UpdateObjectDto } from '../dto/dict.dto';

@Injectable()
export class ObjectsService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.objectSite.findMany({
      include: { access: { select: { userId: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(({ access, ...o }) => ({ ...o, userIds: access.map((a) => a.userId) }));
  }

  create(dto: CreateObjectDto) {
    return this.prisma.objectSite.create({
      data: { name: dto.name, color: dto.color || 'stone', departmentId: dto.departmentId || null },
    });
  }

  update(id: string, dto: UpdateObjectDto) {
    return this.prisma.objectSite.update({ where: { id }, data: { ...dto } });
  }

  async remove(id: string) {
    await this.prisma.objectSite.delete({ where: { id } });
    return { ok: true };
  }

  async setAccess(id: string, userIds: string[]) {
    await this.prisma.$transaction([
      this.prisma.objectAccess.deleteMany({ where: { objectId: id } }),
      this.prisma.objectAccess.createMany({ data: userIds.map((userId) => ({ objectId: id, userId })) }),
    ]);
    return { ok: true };
  }
}
