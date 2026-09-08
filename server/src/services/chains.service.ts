import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RequestType } from '@prisma/client';
import { ChainStepDto } from '../dto/chain.dto';

@Injectable()
export class ChainsService {
  constructor(private prisma: PrismaService) {}

  listSupply(organizationId: string) {
    return this.prisma.supplyChainStep.findMany({ where: { organizationId }, orderBy: [{ departmentId: 'asc' }, { type: 'asc' }, { order: 'asc' }] });
  }

  listOrder(organizationId: string) {
    return this.prisma.orderChainStep.findMany({ where: { organizationId }, orderBy: [{ departmentId: 'asc' }, { order: 'asc' }] });
  }

  private async checkApprovers(organizationId: string, steps: ChainStepDto[]) {
    const ids = [...new Set(steps.map((s) => s.approverId))];
    const found = await this.prisma.user.count({ where: { id: { in: ids }, organizationId } });
    if (found !== ids.length) throw new BadRequestException('Указан несуществующий согласующий');
  }

  private async checkDepartment(organizationId: string, departmentId: string) {
    const dept = await this.prisma.department.findFirst({ where: { id: departmentId, organizationId } });
    if (!dept) throw new BadRequestException('Отдел не найден');
  }

  async setSupply(organizationId: string, departmentId: string, type: RequestType, steps: ChainStepDto[]) {
    await this.checkDepartment(organizationId, departmentId);
    await this.checkApprovers(organizationId, steps);
    await this.prisma.$transaction([
      this.prisma.supplyChainStep.deleteMany({ where: { departmentId, type, organizationId } }),
      this.prisma.supplyChainStep.createMany({
        data: steps.map((s, i) => ({ organizationId, departmentId, type, order: i, approverId: s.approverId, label: s.label })),
      }),
    ]);
    return this.listSupply(organizationId);
  }

  async setOrder(organizationId: string, departmentId: string, steps: ChainStepDto[]) {
    await this.checkDepartment(organizationId, departmentId);
    await this.checkApprovers(organizationId, steps);
    await this.prisma.$transaction([
      this.prisma.orderChainStep.deleteMany({ where: { departmentId, organizationId } }),
      this.prisma.orderChainStep.createMany({
        data: steps.map((s, i) => ({ organizationId, departmentId, order: i, approverId: s.approverId, label: s.label })),
      }),
    ]);
    return this.listOrder(organizationId);
  }
}
