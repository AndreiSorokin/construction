import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OrdersService } from '../services/orders.service';
import { CreateOrderDto, OrderDecideDto } from '../dto/order.dto';
import { CurrentUser, AuthUser } from '../decorators/current-user.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query('period') period?: string) {
    return this.orders.list(u, { period });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.orders.getOne(id);
  }

  // доступ проверяется в сервисе (ordersAccess / ADMIN)
  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() u: AuthUser) {
    return this.orders.create(dto, u);
  }

  @Post(':id/decide')
  decide(@Param('id') id: string, @Body() dto: OrderDecideDto, @CurrentUser() u: AuthUser) {
    return this.orders.decide(id, u, dto);
  }
}
