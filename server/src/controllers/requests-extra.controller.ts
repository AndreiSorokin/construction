import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { RequestsExtraService } from '../services/requests-extra.service';
import { CurrentUser, AuthUser } from '../decorators/current-user.decorator';
import {
  ConsolidateDto, DueDto, EditRequestDto, ItemPatchDto, PriorityDto, SpentDto,
} from '../dto/request-extra.dto';

@Controller('requests')
export class RequestsExtraController {
  constructor(private extra: RequestsExtraService) {}

  @Patch(':id')
  edit(@Param('id') id: string, @Body() dto: EditRequestDto, @CurrentUser() u: AuthUser) {
    return this.extra.edit(id, u, dto);
  }

  @Post(':id/resubmit')
  resubmit(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.extra.resubmit(id, u); }

  @Post(':id/withdraw')
  withdraw(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.extra.withdraw(id, u); }

  @Patch(':id/priority')
  priority(@Param('id') id: string, @Body() dto: PriorityDto, @CurrentUser() u: AuthUser) {
    return this.extra.setPriority(id, u, dto.priority);
  }

  @Patch(':id/due')
  due(@Param('id') id: string, @Body() dto: DueDto, @CurrentUser() u: AuthUser) {
    return this.extra.setDue(id, u, dto.due ?? null);
  }

  @Post(':id/release')
  release(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.extra.release(id, u); }

  @Patch(':id/items/:itemId')
  item(@Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: ItemPatchDto, @CurrentUser() u: AuthUser) {
    return this.extra.patchItem(id, itemId, u, dto);
  }

  @Patch(':id/spent')
  spent(@Param('id') id: string, @Body() dto: SpentDto, @CurrentUser() u: AuthUser) {
    return this.extra.setSpent(id, u, dto.spent ?? null);
  }

  @Post('consolidate')
  consolidate(@Body() dto: ConsolidateDto, @CurrentUser() u: AuthUser) { return this.extra.consolidate(u, dto); }

  @Post(':id/unconsolidate')
  unconsolidate(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.extra.unconsolidate(id, u); }

}
