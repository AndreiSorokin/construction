import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ChainsService } from '../services/chains.service';
import { SetChainDto } from '../dto/chain.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RequestType, Role } from '@prisma/client';

@Controller('chains')
export class ChainsController {
  constructor(private chains: ChainsService) {}

  @Get('supply') listSupply() { return this.chains.listSupply(); }

  @Get('order') listOrder() { return this.chains.listOrder(); }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Put('supply/:departmentId/:type')
  setSupply(@CurrentUser('orgId') orgId: string, @Param('departmentId') departmentId: string, @Param('type') type: RequestType, @Body() dto: SetChainDto) {
    return this.chains.setSupply(orgId, departmentId, type, dto.steps);
  }

  @UseGuards(RolesGuard) @Roles(Role.ADMIN)
  @Put('order/:departmentId')
  setOrder(@CurrentUser('orgId') orgId: string, @Param('departmentId') departmentId: string, @Body() dto: SetChainDto) {
    return this.chains.setOrder(orgId, departmentId, dto.steps);
  }
}
