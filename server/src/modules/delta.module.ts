import { Module } from '@nestjs/common';
import { RequestsExtraController } from '../controllers/requests-extra.controller';
import { RequestsExtraService } from '../services/requests-extra.service';
import { OrdersExtraController } from '../controllers/orders-extra.controller';
import { OrdersExtraService } from '../services/orders-extra.service';
import { MailModule } from './mail.module';

@Module({
  imports: [MailModule],
  controllers: [RequestsExtraController, OrdersExtraController],
  providers: [RequestsExtraService, OrdersExtraService],
})
export class DeltaModule {}
