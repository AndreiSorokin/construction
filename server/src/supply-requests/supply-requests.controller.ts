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
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AuthenticatedUser } from "../auth/types/authenticated-user";
import { CreateMaterialSupplyRequestDto } from "./dto/create-material-supply-request.dto";
import { CreateMoneySupplyRequestDto } from "./dto/create-money-supply-request.dto";
import { CreateTransportSupplyRequestDto } from "./dto/create-transport-supply-request.dto";
import { FindSupplyRequestsDto } from "./dto/find-supply-requests.dto";
import { RequestActionDto } from "./dto/request-action.dto";
import { SetPtoLimitPricesDto } from "./dto/set-pto-limit-prices.dto";
import { SetSupplierPurchasePricesDto } from "./dto/set-supplier-purchase-prices.dto";
import { SupplyRequestsService } from "./supply-requests.service";

@Controller("supply-requests")
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplyRequestsController {
  constructor(private readonly supplyRequestsService: SupplyRequestsService) {}

  @Post("materials")
  @Roles(UserRole.FOREMAN)
  createMaterialRequest(
    @Body() dto: CreateMaterialSupplyRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.createMaterialRequest(dto, user.id);
  }

  @Post("transport")
  @Roles(UserRole.SITE_MANAGER)
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

  @Patch(":id/pto-limit-prices")
  @Roles(UserRole.PTO)
  setPtoLimitPrices(
    @Param("id") id: string,
    @Body() dto: SetPtoLimitPricesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.setPtoLimitPrices(id, dto, user.id);
  }

  @Patch(":id/chief-engineer/approve")
  @Roles(UserRole.CHIEF_ENGINEER)
  approveByChiefEngineer(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.approveByChiefEngineer(id, dto, user.id);
  }

  @Patch(":id/chief-engineer/return-to-pto")
  @Roles(UserRole.CHIEF_ENGINEER)
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
  @Roles(UserRole.SUPPLY)
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

  @Patch(":id/transport/supply/approve")
  @Roles(UserRole.SUPPLY)
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
  @Roles(UserRole.DIRECTOR)
  approveByDirector(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.approveByDirector(id, dto, user.id);
  }

  @Patch(":id/director/return")
  @Roles(UserRole.DIRECTOR)
  returnToSupply(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.returnToSupply(id, dto, user.id);
  }

  @Patch(":id/director/reject")
  @Roles(UserRole.DIRECTOR)
  rejectByDirector(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.rejectByDirector(id, dto, user.id);
  }

  @Patch(":id/director/archive")
  @Roles(UserRole.DIRECTOR)
  archiveByDirector(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.archiveByDirector(id, dto, user.id);
  }

  @Patch(":id/complete")
  @Roles(UserRole.SUPPLY)
  complete(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.complete(id, dto, user.id);
  }

  @Patch(":id/archive")
  @Roles(UserRole.SUPPLY, UserRole.DIRECTOR)
  archive(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.archive(id, dto, user.id);
  }
}
