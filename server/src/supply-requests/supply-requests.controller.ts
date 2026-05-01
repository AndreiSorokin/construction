import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CreateMaterialSupplyRequestDto } from "./dto/create-material-supply-request.dto";
import { RequestActionDto } from "./dto/request-action.dto";
import { SetPtoLimitPricesDto } from "./dto/set-pto-limit-prices.dto";
import { SetSupplierPurchasePricesDto } from "./dto/set-supplier-purchase-prices.dto";
import { SupplyRequestsService } from "./supply-requests.service";

@Controller("supply-requests")
export class SupplyRequestsController {
  constructor(private readonly supplyRequestsService: SupplyRequestsService) {}

  @Post("materials")
  createMaterialRequest(@Body() dto: CreateMaterialSupplyRequestDto) {
    return this.supplyRequestsService.createMaterialRequest(dto);
  }

  @Get()
  findAll() {
    return this.supplyRequestsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.supplyRequestsService.findOne(id);
  }

  @Patch(":id/pto-limit-prices")
  setPtoLimitPrices(
    @Param("id") id: string,
    @Body() dto: SetPtoLimitPricesDto,
  ) {
    return this.supplyRequestsService.setPtoLimitPrices(id, dto);
  }

  @Patch(":id/chief-engineer/approve")
  approveByChiefEngineer(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
  ) {
    return this.supplyRequestsService.approveByChiefEngineer(id, dto);
  }

  @Patch(":id/supplier-purchase-prices")
  setSupplierPurchasePrices(
    @Param("id") id: string,
    @Body() dto: SetSupplierPurchasePricesDto,
  ) {
    return this.supplyRequestsService.setSupplierPurchasePrices(id, dto);
  }

  @Patch(":id/director/approve")
  approveByDirector(@Param("id") id: string, @Body() dto: RequestActionDto) {
    return this.supplyRequestsService.approveByDirector(id, dto);
  }

  @Patch(":id/director/return")
  returnToSupply(@Param("id") id: string, @Body() dto: RequestActionDto) {
    return this.supplyRequestsService.returnToSupply(id, dto);
  }

  @Patch(":id/director/reject")
  rejectByDirector(@Param("id") id: string, @Body() dto: RequestActionDto) {
    return this.supplyRequestsService.rejectByDirector(id, dto);
  }

  @Patch(":id/director/archive")
  archiveByDirector(@Param("id") id: string, @Body() dto: RequestActionDto) {
    return this.supplyRequestsService.archiveByDirector(id, dto);
  }

  @Patch(":id/complete")
  complete(@Param("id") id: string, @Body() dto: RequestActionDto) {
    return this.supplyRequestsService.complete(id, dto);
  }

  @Patch(":id/archive")
  archive(@Param("id") id: string, @Body() dto: RequestActionDto) {
    return this.supplyRequestsService.archive(id, dto);
  }
}
