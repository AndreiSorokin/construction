import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { AuthenticatedUser } from "../auth/types/authenticated-user";
import { AssignSupplyRequestDto } from "./dto/assign-supply-request.dto";
import { CreateMaterialSupplyRequestDto } from "./dto/create-material-supply-request.dto";
import { CreateMoneySupplyRequestDto } from "./dto/create-money-supply-request.dto";
import { CreateTransportSupplyRequestDto } from "./dto/create-transport-supply-request.dto";
import { DeleteSupplyRequestItemDto } from "./dto/delete-supply-request-item.dto";
import { FindSupplyRequestsDto } from "./dto/find-supply-requests.dto";
import { RequestActionDto } from "./dto/request-action.dto";
import { SetPtoLimitPricesDto } from "./dto/set-pto-limit-prices.dto";
import { SetSupplierPurchasePricesDto } from "./dto/set-supplier-purchase-prices.dto";
import { SupplyRequestsService } from "./supply-requests.service";
import { UpdateSupplyRequestItemDto } from "./dto/update-supply-request-item.dto";

@Controller("supply-requests")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplyRequestsController {
  constructor(private readonly supplyRequestsService: SupplyRequestsService) {}

  @Post("materials")
  createMaterialRequest(
    @Body() dto: CreateMaterialSupplyRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.createMaterialRequest(dto, user.id);
  }

  @Post("transport")
  createTransportRequest(
    @Body() dto: CreateTransportSupplyRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.createTransportRequest(dto, user.id);
  }

  @Post("money")
  createMoneyRequest(
    @Body() dto: CreateMoneySupplyRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.createMoneyRequest(dto, user.id);
  }

  @Get()
  findAll(@Query() query: FindSupplyRequestsDto) {
    return this.supplyRequestsService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.supplyRequestsService.findOne(id);
  }

  @Patch(":id/items/:itemId")
  updateRequestItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateSupplyRequestItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.updateRequestItem(
      id,
      itemId,
      dto,
      user.id,
    );
  }

  @Patch(":id/items/:itemId/delete")
  deleteRequestItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() dto: DeleteSupplyRequestItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.deleteRequestItem(
      id,
      itemId,
      dto,
      user.id,
    );
  }

  @Patch(":id/pto-limit-prices")
  setPtoLimitPrices(
    @Param("id") id: string,
    @Body() dto: SetPtoLimitPricesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.setPtoLimitPrices(id, dto, user.id);
  }

  @Patch(":id/chief-engineer/approve")
  approveByChiefEngineer(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.approveByChiefEngineer(id, dto, user.id);
  }

  @Patch(":id/chief-engineer/return-to-pto")
  returnToPtoByChiefEngineer(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.returnToPtoByChiefEngineer(
      id,
      dto,
      user.id,
    );
  }

  @Patch(":id/supplier-purchase-prices")
  setSupplierPurchasePrices(
    @Param("id") id: string,
    @Body() dto: SetSupplierPurchasePricesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.setSupplierPurchasePrices(
      id,
      dto,
      user.id,
    );
  }

  @Patch(":id/supply-manager/assign")
  assignToSupplyUser(
    @Param("id") id: string,
    @Body() dto: AssignSupplyRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.assignToSupplyUser(id, dto, user.id);
  }

  @Patch(":id/transport/supply/approve")
  approveTransportBySupply(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.approveTransportBySupply(
      id,
      dto,
      user.id,
    );
  }

  @Patch(":id/director/approve")
  approveByDirector(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.approveByDirector(id, dto, user.id);
  }

  @Patch(":id/director/return")
  returnToSupply(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.returnToSupply(id, dto, user.id);
  }

  @Patch(":id/director/reject")
  rejectByDirector(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.rejectByDirector(id, dto, user.id);
  }

  @Patch(":id/director/archive")
  archiveByDirector(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.archiveByDirector(id, dto, user.id);
  }

  @Patch(":id/complete")
  complete(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.complete(id, dto, user.id);
  }

  @Patch(":id/archive")
  archive(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.archive(id, dto, user.id);
  }
}
