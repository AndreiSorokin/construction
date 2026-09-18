import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RequestStatus } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { RequestsService } from './requests.service';

const AUTO_CONFIRM_AFTER_MS = 48 * 60 * 60 * 1000;

/**
 * Единственное место в проекте, где заявки сканируются сразу по ВСЕМ организациям без
 * фильтра по organizationId — фоновая задача не привязана к запросу конкретного пользователя.
 */
@Injectable()
export class RequestsAutoConfirmService {
  private readonly logger = new Logger(RequestsAutoConfirmService.name);

  constructor(private prisma: PrismaService, private requests: RequestsService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run() {
    const cutoff = new Date(Date.now() - AUTO_CONFIRM_AFTER_MS);
    const due = await this.prisma.request.findMany({
      where: { status: RequestStatus.FULFILLED, fulfilledAt: { lte: cutoff } },
      select: { id: true, number: true },
    });
    for (const r of due) {
      await this.requests.autoConfirm(r.id);
      this.logger.log(`Автоподтверждена заявка ${r.number} (${r.id}) — 48ч без ответа заявителя`);
    }
  }
}
