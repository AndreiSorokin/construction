import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RequestType } from '@prisma/client';
import { ChainStepDto } from '../dto/chain.dto';

@Injectable()
export class ChainsService {
  constructor(private prisma: PrismaService) {}

  listSupply() {
    return this.prisma.supplyChainStep.findMany({ orderBy: [{ departmentId: 'asc' }, { type: 'asc' }, { order: 'asc' }] });
  }

  listOrder() {
    return this.prisma.orderChainStep.findMany({ orderBy: [{ departmentId: 'asc' }, { order: 'asc' }] });
  }

  private async checkApprovers(steps: ChainStepDto[]) {
    const ids = [...new Set(steps.map((s) => s.approverId))];
    const found = await this.prisma.user.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new BadRequestException('Указан несуществующий согласующий');
  }

  async setSupply(departmentId: string, type: RequestType, steps: ChainStepDto[]) {
    await this.checkApprovers(steps);
    await this.prisma.$transaction([
      this.prisma.supplyChainStep.deleteMany({ where: { departmentId, type } }),
      this.prisma.supplyChainStep.createMany({
        data: steps.map((s, i) => ({ departmentId, type, order: i, approverId: s.approverId, label: s.label })),
      }),
    ]);
    return this.listSupply();
  }

  async setOrder(departmentId: string, steps: ChainStepDto[]) {
    await this.checkApprovers(steps);
    await this.prisma.$transaction([
      this.prisma.orderChainStep.deleteMany({ where: { departmentId } }),
      this.prisma.orderChainStep.createMany({
        data: steps.map((s, i) => ({ departmentId, order: i, approverId: s.approverId, label: s.label })),
      }),
    ]);
    return this.listOrder();
  }
}
