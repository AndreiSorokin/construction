import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UpdateNoteDto } from '../dto/note.dto';

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.note.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
  }

  create(userId: string) {
    return this.prisma.note.create({ data: { userId } });
  }

  private async own(id: string, userId: string) {
    const n = await this.prisma.note.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Заметка не найдена');
    if (n.userId !== userId) throw new ForbiddenException('Чужая заметка');
    return n;
  }

  async update(id: string, userId: string, dto: UpdateNoteDto) {
    await this.own(id, userId);
    return this.prisma.note.update({ where: { id }, data: { ...dto } });
  }

  async remove(id: string, userId: string) {
    await this.own(id, userId);
    await this.prisma.note.delete({ where: { id } });
    return { ok: true };
  }
}
