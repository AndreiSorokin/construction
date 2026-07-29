import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { OrdersExtraService } from '../services/orders-extra.service';
import { CurrentUser, AuthUser } from '../decorators/current-user.decorator';
import { LinePatchDto } from '../dto/order-extra.dto';

@Controller('orders')
export class OrdersExtraController {
  constructor(private extra: OrdersExtraService) {}

  @Patch(':id/lines/:lineId')
  patchLine(@Param('id') id: string, @Param('lineId') lineId: string, @Body() dto: LinePatchDto, @CurrentUser() u: AuthUser) {
    return this.extra.patchLine(id, lineId, u, dto);
  }

  @Delete(':id/lines/:lineId')
  removeLine(@Param('id') id: string, @Param('lineId') lineId: string, @CurrentUser() u: AuthUser) {
    return this.extra.removeLine(id, lineId, u);
  }

  @Post(':id/resubmit')
  resubmit(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.extra.resubmit(id, u); }
}
