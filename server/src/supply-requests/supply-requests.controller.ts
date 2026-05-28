import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { AuthenticatedUser } from "../auth/types/authenticated-user";
import { AssignSupplyRequestDto } from "./dto/assign-supply-request.dto";
import { AssignWorkshopManagerDto } from "./dto/assign-workshop-manager.dto";
import { CompleteStorekeeperRequestDto } from "./dto/complete-storekeeper-request.dto";
import { CreateMaterialSupplyRequestDto } from "./dto/create-material-supply-request.dto";
import { CreateMoneySupplyRequestDto } from "./dto/create-money-supply-request.dto";
import { CreateProductionSupplyRequestDto } from "./dto/create-production-supply-request.dto";
import { CreateTransportSupplyRequestDto } from "./dto/create-transport-supply-request.dto";
import { DeleteSupplyRequestItemDto } from "./dto/delete-supply-request-item.dto";
import { FindSupplyRequestsDto } from "./dto/find-supply-requests.dto";
import { RequestActionDto } from "./dto/request-action.dto";
import { ReviewRequestItemsDto } from "./dto/review-request-items.dto";
import { SendToStorekeeperDto } from "./dto/send-to-storekeeper.dto";
import { SetPtoLimitPricesDto } from "./dto/set-pto-limit-prices.dto";
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

  @Post("production")
  @UseInterceptors(FilesInterceptor("files", 10))
  createProductionRequest(
    @Body() dto: CreateProductionSupplyRequestDto,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.createProductionRequest(
      dto,
      files,
      user.id,
    );
  }

  @Get()
  findAll(@Query() query: FindSupplyRequestsDto) {
    return this.supplyRequestsService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.supplyRequestsService.findOne(id);
  }

  @Get(":id/invoices/:invoiceId/download")
  async downloadInvoice(
    @Param("id") id: string,
    @Param("invoiceId") invoiceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const invoice = await this.supplyRequestsService.findInvoiceFile(
      id,
      invoiceId,
      user.id,
    );

    response.set({
      "Content-Type": invoice.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(
        invoice.originalName,
      )}"`,
    });

    return new StreamableFile(invoice.file);
  }

  @Get(":id/attachments/:attachmentId/download")
  async downloadAttachment(
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const attachment = await this.supplyRequestsService.findAttachmentFile(
      id,
      attachmentId,
      user.id,
    );

    response.set({
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(
        attachment.originalName,
      )}"`,
    });

    return new StreamableFile(attachment.file);
  }

  @Delete(":id/invoices/:invoiceId")
  deleteInvoice(
    @Param("id") id: string,
    @Param("invoiceId") invoiceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.deleteInvoice(id, invoiceId, user.id);
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

  @Patch(":id/reject-to-previous")
  rejectToPreviousStep(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.rejectToPreviousStep(id, dto, user.id);
  }

  @Patch(":id/pto-limit-prices")
  setPtoLimitPrices(
    @Param("id") id: string,
    @Body() dto: SetPtoLimitPricesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.setPtoLimitPrices(id, dto, user.id);
  }

  @Patch(":id/pto/approve")
  approveByPto(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.approveByPto(id, dto, user.id);
  }

  @Patch(":id/chief-engineer/approve")
  approveByChiefEngineer(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.approveByChiefEngineer(id, dto, user.id);
  }

  @Patch(":id/warehouse-manager/approve")
  approveByWarehouseManager(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.approveByWarehouseManager(
      id,
      dto,
      user.id,
    );
  }

  @Patch(":id/chief-engineer/review-items")
  reviewItemsByChiefEngineer(
    @Param("id") id: string,
    @Body() dto: ReviewRequestItemsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.reviewItemsByChiefEngineer(
      id,
      dto,
      user.id,
    );
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

  @Patch(":id/chief-engineer/reject")
  rejectByChiefEngineer(
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

  @Patch(":id/deputy-production-director/approve")
  approveByDeputyProductionDirector(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.approveByDeputyProductionDirector(
      id,
      dto,
      user.id,
    );
  }

  @Patch(":id/deputy-production-director/assign-workshop")
  assignToWorkshopManager(
    @Param("id") id: string,
    @Body() dto: AssignWorkshopManagerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.assignToWorkshopManager(
      id,
      dto,
      user.id,
    );
  }

  @Patch(":id/deputy-production-director/reject")
  rejectByDeputyProductionDirector(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.rejectByDeputyProductionDirector(
      id,
      dto,
      user.id,
    );
  }

  @Patch(":id/deputy-transport-director/approve")
  approveByDeputyTransportDirector(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.approveByDeputyTransportDirector(
      id,
      dto,
      user.id,
    );
  }

  @Patch(":id/deputy-transport-director/reject")
  rejectByDeputyTransportDirector(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.rejectByDeputyTransportDirector(
      id,
      dto,
      user.id,
    );
  }

  @Patch(":id/accountant/approve")
  approveByAccountant(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.approveByAccountant(id, dto, user.id);
  }

  @Patch(":id/invoices/send-to-director")
  @UseInterceptors(FilesInterceptor("files", 10))
  attachInvoicesAndSendToDirector(
    @Param("id") id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.attachInvoicesAndSendToDirector(
      id,
      files,
      dto,
      user.id,
    );
  }

  @Patch(":id/money/send-to-director")
  sendMoneyToDirectorBySupply(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.sendMoneyToDirectorBySupply(
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

  @Patch(":id/supply-manager/send-to-garage")
  sendTransportToGarageManager(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.sendTransportToGarageManager(
      id,
      dto,
      user.id,
    );
  }

  @Patch(":id/garage-manager/complete")
  completeByGarageManager(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.completeByGarageManager(id, dto, user.id);
  }

  @Patch(":id/transport/author/complete")
  completeTransportByAuthor(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.completeTransportByAuthor(
      id,
      dto,
      user.id,
    );
  }

  @Patch(":id/workshop-manager/approve")
  approveByWorkshopManager(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.approveByWorkshopManager(
      id,
      dto,
      user.id,
    );
  }

  @Patch(":id/production/author/complete")
  completeProductionByAuthor(
    @Param("id") id: string,
    @Body() dto: RequestActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.completeProductionByAuthor(
      id,
      dto,
      user.id,
    );
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
    @Body() dto: SendToStorekeeperDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.complete(id, dto, user.id);
  }

  @Patch(":id/storekeeper/complete")
  completeByStorekeeper(
    @Param("id") id: string,
    @Body() dto: CompleteStorekeeperRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.supplyRequestsService.completeByStorekeeper(id, dto, user.id);
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
