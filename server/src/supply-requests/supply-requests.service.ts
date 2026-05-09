import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import { mkdir, unlink, writeFile } from "fs/promises";
import { extname, join } from "path";
import {
  ApprovalAction,
  ObjectLimitType,
  ObjectType,
  PriceField,
  Prisma,
  SupplyRequestStatus,
  SupplyRequestType,
  UserRole,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AssignSupplyRequestDto } from "./dto/assign-supply-request.dto";
import { CreateMaterialSupplyRequestDto } from "./dto/create-material-supply-request.dto";
import { CreateMoneySupplyRequestDto } from "./dto/create-money-supply-request.dto";
import { CreateTransportSupplyRequestDto } from "./dto/create-transport-supply-request.dto";
import { DeleteSupplyRequestItemDto } from "./dto/delete-supply-request-item.dto";
import { FindSupplyRequestsDto } from "./dto/find-supply-requests.dto";
import { RequestActionDto } from "./dto/request-action.dto";
import { ReviewRequestItemsDto } from "./dto/review-request-items.dto";
import { SetPtoLimitPricesDto } from "./dto/set-pto-limit-prices.dto";
import { UpdateSupplyRequestItemDto } from "./dto/update-supply-request-item.dto";

@Injectable()
export class SupplyRequestsService {
  private readonly invoiceUploadsDir = join(
    process.cwd(),
    "uploads",
    "invoices",
  );

  constructor(private readonly prisma: PrismaService) {}

  async createMaterialRequest(
    dto: CreateMaterialSupplyRequestDto,
    authorId: string,
  ) {
    if (!dto.items?.length) {
      throw new BadRequestException("Request must contain at least one item");
    }

    const route = await this.getInitialRequestRoute(
      authorId,
      dto.objectId,
      SupplyRequestType.MATERIAL,
    );

    for (const item of dto.items) {
      if (
        !item.materialName.trim() ||
        !item.measurementUnit.trim() ||
        new Prisma.Decimal(item.quantity).lte(0)
      ) {
        throw new BadRequestException(
          "Each material item must contain name, measurement unit and positive quantity",
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.supplyRequest.create({
        data: {
          requestNumber: await this.createRequestNumber(tx, "MAT"),
          type: SupplyRequestType.MATERIAL,
          objectId: dto.objectId,
          authorId,
          status: route.status,
          items: {
            create: dto.items.map((item) => ({
              materialNameSnapshot: item.materialName.trim(),
              materialTypeSnapshot: "",
              measurementUnitSnapshot: item.measurementUnit.trim(),
              estimatedPriceSnapshot: new Prisma.Decimal(0),
              quantity: new Prisma.Decimal(item.quantity),
            })),
          },
          approvalHistory: {
            create: {
              actorId: authorId,
              action: ApprovalAction.CREATED,
              fromStatus: null,
              toStatus: route.status,
              comment: route.comment,
            },
          },
        },
        include: this.requestInclude,
      });

      return request;
    });
  }

  async createTransportRequest(
    dto: CreateTransportSupplyRequestDto,
    authorId: string,
  ) {
    if (!dto.transportType.trim() || !dto.purpose.trim()) {
      throw new BadRequestException(
        "Transport request must contain transport type and purpose",
      );
    }

    const route = await this.getInitialRequestRoute(
      authorId,
      dto.objectId,
      SupplyRequestType.TRANSPORT,
    );

    return this.prisma.$transaction(async (tx) =>
      tx.supplyRequest.create({
        data: {
          requestNumber: await this.createRequestNumber(tx, "TRN"),
          type: SupplyRequestType.TRANSPORT,
          objectId: dto.objectId,
          authorId,
          transportType: dto.transportType.trim(),
          purpose: dto.purpose.trim(),
          status: route.status,
          approvalHistory: {
            create: {
              actorId: authorId,
              action: ApprovalAction.CREATED,
              fromStatus: null,
              toStatus: route.status,
              comment: route.comment,
            },
          },
        },
        include: this.requestInclude,
      }),
    );
  }

  async createMoneyRequest(dto: CreateMoneySupplyRequestDto, authorId: string) {
    if (new Prisma.Decimal(dto.amount).lte(0) || !dto.paymentPurpose.trim()) {
      throw new BadRequestException(
        "Money request must contain positive amount and payment purpose",
      );
    }

    const route = await this.getInitialRequestRoute(
      authorId,
      dto.objectId,
      SupplyRequestType.MONEY,
    );

    return this.prisma.$transaction(async (tx) =>
      tx.supplyRequest.create({
        data: {
          requestNumber: await this.createRequestNumber(tx, "MON"),
          type: SupplyRequestType.MONEY,
          objectId: dto.objectId,
          authorId,
          amount: new Prisma.Decimal(dto.amount),
          paymentPurpose: dto.paymentPurpose.trim(),
          status: route.status,
          approvalHistory: {
            create: {
              actorId: authorId,
              action: ApprovalAction.CREATED,
              fromStatus: null,
              toStatus: route.status,
              comment: route.comment,
            },
          },
        },
        include: this.requestInclude,
      }),
    );
  }

  async findAll(query: FindSupplyRequestsDto = {}) {
    const hasPaginationOrFilters = Boolean(
      query.page ||
        query.limit ||
        query.objectSearch ||
        query.type ||
        query.status ||
        query.dateFrom ||
        query.dateTo,
    );

    if (!hasPaginationOrFilters) {
      return this.prisma.supplyRequest.findMany({
        include: this.requestInclude,
        orderBy: { createdAt: "desc" },
      });
    }

    const page = this.parsePositiveInteger(query.page, 1);
    const limit = Math.min(this.parsePositiveInteger(query.limit, 10), 100);
    const where = this.buildFindAllWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplyRequest.findMany({
        where,
        include: this.requestInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supplyRequest.count({ where }),
    ]);

    return {
      items,
      limit,
      page,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    };
  }

  private buildFindAllWhere(query: FindSupplyRequestsDto) {
    const where: Prisma.SupplyRequestWhereInput = {};

    if (query.objectSearch?.trim()) {
      where.object = {
        name: {
          contains: query.objectSearch.trim(),
          mode: "insensitive",
        },
      };
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};

      if (query.dateFrom) {
        where.createdAt.gte = new Date(`${query.dateFrom}T00:00:00`);
      }

      if (query.dateTo) {
        where.createdAt.lte = new Date(`${query.dateTo}T23:59:59`);
      }
    }

    return where;
  }

  private parsePositiveInteger(value: string | undefined, fallback: number) {
    const parsedValue = Number(value);

    if (!Number.isInteger(parsedValue) || parsedValue < 1) {
      return fallback;
    }

    return parsedValue;
  }

  async findOne(id: string) {
    const request = await this.prisma.supplyRequest.findUnique({
      where: { id },
      include: this.requestInclude,
    });

    if (!request) {
      throw new NotFoundException("Supply request not found");
    }

    return request;
  }

  async findInvoiceFile(id: string, invoiceId: string, actorId: string) {
    const invoice = await this.prisma.supplyRequestInvoice.findFirst({
      where: {
        id: invoiceId,
        requestId: id,
      },
      include: {
        request: {
          select: {
            objectId: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    await this.ensureUserObjectAccess(actorId, invoice.request.objectId);

    return {
      file: createReadStream(invoice.path),
      mimeType: invoice.mimeType,
      originalName: invoice.originalName,
    };
  }

  async deleteInvoice(id: string, invoiceId: string, actorId: string) {
    const invoice = await this.prisma.supplyRequestInvoice.findFirst({
      where: {
        id: invoiceId,
        requestId: id,
      },
      include: {
        request: {
          include: this.requestInclude,
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    if (
      invoice.request.type !== SupplyRequestType.MATERIAL ||
      (invoice.request.status !== SupplyRequestStatus.PENDING_SUPPLY &&
        invoice.request.status !== SupplyRequestStatus.RETURNED_TO_SUPPLY)
    ) {
      throw new BadRequestException(
        "Invoices can be deleted only before sending material request to director",
      );
    }

    await this.ensureUserObjectRole(actorId, invoice.request.objectId, [
      UserRole.SUPPLY,
    ]);
    this.ensureAssignedSupplyUser(invoice.request, actorId);

    await this.prisma.supplyRequestInvoice.delete({
      where: { id: invoice.id },
    });

    await unlink(invoice.path).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") {
        throw error;
      }
    });

    return this.findOne(id);
  }

  async updateRequestItem(
    id: string,
    itemId: string,
    dto: UpdateSupplyRequestItemDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_PTO,
      SupplyRequestStatus.PENDING_CHIEF_ENGINEER,
      SupplyRequestStatus.PENDING_DEPUTY_PRODUCTION_DIRECTOR,
      SupplyRequestStatus.PENDING_DIRECTOR,
    ]);

    const actorRole = await this.ensureCanModifyRequestItems(
      actorId,
      request.objectId,
      request.status,
    );

    if (request.type !== SupplyRequestType.MATERIAL) {
      throw new BadRequestException(
        "Only material request items can be edited",
      );
    }

    const requestItem = request.items.find((item) => item.id === itemId);

    if (!requestItem) {
      throw new NotFoundException("Supply request item not found");
    }

    const newQuantity = new Prisma.Decimal(dto.quantity);

    if (newQuantity.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Quantity must be greater than zero");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.supplyRequestItem.update({
        where: { id: itemId },
        data: {
          quantity: newQuantity,
        },
      });

      await tx.approvalHistory.create({
        data: {
          requestId: id,
          actorId,
          action: ApprovalAction.REQUEST_ITEM_UPDATED,
          fromStatus: request.status,
          toStatus: request.status,
          comment: dto.comment,
          changesJson: {
            actorRole,
            itemId,
            materialName: requestItem.materialNameSnapshot,
            oldQuantity: requestItem.quantity.toString(),
            newQuantity: newQuantity.toString(),
          },
        },
      });

      return tx.supplyRequest.findUnique({
        where: { id },
        include: this.requestInclude,
      });
    });
  }

  async deleteRequestItem(
    id: string,
    itemId: string,
    dto: DeleteSupplyRequestItemDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_PTO,
      SupplyRequestStatus.PENDING_CHIEF_ENGINEER,
      SupplyRequestStatus.PENDING_DEPUTY_PRODUCTION_DIRECTOR,
      SupplyRequestStatus.PENDING_DIRECTOR,
    ]);

    const actorRole = await this.ensureCanModifyRequestItems(
      actorId,
      request.objectId,
      request.status,
    );

    if (request.type !== SupplyRequestType.MATERIAL) {
      throw new BadRequestException(
        "Only material request items can be deleted",
      );
    }

    if (request.items.length <= 1) {
      throw new BadRequestException(
        "Material request must contain at least one item",
      );
    }

    const requestItem = request.items.find((item) => item.id === itemId);

    if (!requestItem) {
      throw new NotFoundException("Supply request item not found");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.supplyRequestItem.delete({
        where: { id: itemId },
      });

      await tx.approvalHistory.create({
        data: {
          requestId: id,
          actorId,
          action: ApprovalAction.REQUEST_ITEM_DELETED,
          fromStatus: request.status,
          toStatus: request.status,
          comment: dto.comment,
          changesJson: {
            actorRole,
            itemId,
            materialName: requestItem.materialNameSnapshot,
            quantity: requestItem.quantity.toString(),
            estimatedPriceSnapshot: requestItem.estimatedPriceSnapshot.toString(),
          },
        },
      });

      return tx.supplyRequest.findUnique({
        where: { id },
        include: this.requestInclude,
      });
    });
  }

  async setPtoLimitPrices(
    id: string,
    dto: SetPtoLimitPricesDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(
      id,
      [SupplyRequestStatus.PENDING_PTO],
      SupplyRequestType.MATERIAL,
    );
    await this.ensureUserObjectRole(actorId, request.objectId, [UserRole.PTO]);

    if (dto.items.length !== request.items.length) {
      throw new BadRequestException(
        "PTO price must be provided for every request item",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const requestItem = request.items.find(
          (existing) => existing.id === item.requestItemId,
        );

        if (!requestItem) {
          throw new BadRequestException(
            "Request item does not belong to request",
          );
        }

        const newValue = new Prisma.Decimal(item.ptoLimitPrice);

        if (newValue.lte(0)) {
          throw new BadRequestException(
            "PTO price must be greater than zero for every request item",
          );
        }

        await tx.requestPriceHistory.create({
          data: {
            requestItemId: requestItem.id,
            actorId,
            field: PriceField.PTO_LIMIT_PRICE,
            oldValue: requestItem.ptoLimitPrice,
            newValue,
          },
        });

        await tx.supplyRequestItem.update({
          where: { id: requestItem.id },
          data: { ptoLimitPrice: newValue },
        });
      }

      return this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.SENT_TO_CHIEF_ENGINEER,
        request.status,
        SupplyRequestStatus.PENDING_CHIEF_ENGINEER,
        dto.comment,
      );
    });
  }

  async approveByChiefEngineer(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(
      id,
      [SupplyRequestStatus.PENDING_CHIEF_ENGINEER],
    );
    if (
      request.type !== SupplyRequestType.MATERIAL &&
      request.type !== SupplyRequestType.TRANSPORT &&
      request.type !== SupplyRequestType.MONEY
    ) {
      throw new BadRequestException("Unsupported request type");
    }
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.CHIEF_ENGINEER,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.SENT_TO_SUPPLY_MANAGER,
        request.status,
        SupplyRequestStatus.PENDING_SUPPLY_MANAGER,
        dto.comment,
      ),
    );
  }

  async reviewItemsByChiefEngineer(
    id: string,
    dto: ReviewRequestItemsDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(
      id,
      [SupplyRequestStatus.PENDING_CHIEF_ENGINEER],
      SupplyRequestType.MATERIAL,
    );
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.CHIEF_ENGINEER,
    ]);

    const approvedItemIds = new Set(dto.approvedItemIds);

    if (approvedItemIds.size !== dto.approvedItemIds.length) {
      throw new BadRequestException("approvedItemIds must be unique");
    }

    const requestItemIds = new Set(request.items.map((item) => item.id));

    for (const itemId of approvedItemIds) {
      if (!requestItemIds.has(itemId)) {
        throw new BadRequestException(
          "Approved item does not belong to request",
        );
      }
    }

    if (approvedItemIds.size === 0) {
      return this.prisma.$transaction((tx) =>
        this.moveRequest(
          tx,
          id,
          actorId,
          ApprovalAction.REJECTED,
          request.status,
          SupplyRequestStatus.REJECTED,
          dto.comment,
        ),
      );
    }

    const rejectedItems = request.items.filter(
      (item) => !approvedItemIds.has(item.id),
    );
    const activeItemsCount = request.items.length - rejectedItems.length;

    if (activeItemsCount < 1) {
      throw new BadRequestException(
        "Material request must contain at least one approved item",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const rejectedItem of rejectedItems) {
        await tx.supplyRequestItem.delete({
          where: { id: rejectedItem.id },
        });

        await tx.approvalHistory.create({
          data: {
            requestId: id,
            actorId,
            action: ApprovalAction.REQUEST_ITEM_DELETED,
            fromStatus: request.status,
            toStatus: request.status,
            comment: dto.comment,
            changesJson: {
              actorRole: UserRole.CHIEF_ENGINEER,
              itemId: rejectedItem.id,
              materialName: rejectedItem.materialNameSnapshot,
              quantity: rejectedItem.quantity.toString(),
              estimatedPriceSnapshot:
                rejectedItem.estimatedPriceSnapshot.toString(),
              reason: "Rejected by chief engineer during selective approval",
            },
          },
        });
      }

      return this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.SENT_TO_SUPPLY_MANAGER,
        request.status,
        SupplyRequestStatus.PENDING_SUPPLY_MANAGER,
        dto.comment,
      );
    });
  }

  async approveByDeputyProductionDirector(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DEPUTY_PRODUCTION_DIRECTOR,
    ]);
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.DEPUTY_PRODUCTION_DIRECTOR,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.SENT_TO_SUPPLY_MANAGER,
        request.status,
        SupplyRequestStatus.PENDING_SUPPLY_MANAGER,
        dto.comment,
      ),
    );
  }

  async rejectByDeputyProductionDirector(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DEPUTY_PRODUCTION_DIRECTOR,
    ]);
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.DEPUTY_PRODUCTION_DIRECTOR,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.REJECTED,
        request.status,
        SupplyRequestStatus.REJECTED,
        dto.comment,
      ),
    );
  }

  async assignToSupplyUser(
    id: string,
    dto: AssignSupplyRequestDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_SUPPLY_MANAGER,
    ]);
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.SUPPLY_MANAGER,
    ]);

    if (request.type === SupplyRequestType.TRANSPORT) {
      throw new BadRequestException(
        "Transport requests must be sent to garage manager",
      );
    }

    await this.ensureUserObjectRole(dto.supplyUserId, request.objectId, [
      UserRole.SUPPLY,
    ]);

    if (
      request.type !== SupplyRequestType.MATERIAL &&
      request.type !== SupplyRequestType.MONEY
    ) {
      throw new BadRequestException(
        "Only material and money requests can be assigned to supply",
      );
    }

    this.ensureMaterialRequestHasActiveItems(request);

    return this.prisma.$transaction(async (tx) => {
      await tx.supplyRequest.update({
        where: { id },
        data: {
          assignedSupplyUserId: dto.supplyUserId,
          assignedById: actorId,
          assignedAt: new Date(),
          status: SupplyRequestStatus.PENDING_SUPPLY,
        },
      });

      await tx.approvalHistory.create({
        data: {
          requestId: id,
          actorId,
          action: ApprovalAction.ASSIGNED_TO_SUPPLY,
          fromStatus: request.status,
          toStatus: SupplyRequestStatus.PENDING_SUPPLY,
          comment: dto.comment,
          changesJson: {
            assignedSupplyUserId: dto.supplyUserId,
          },
        },
      });

      return tx.supplyRequest.findUnique({
        where: { id },
        include: this.requestInclude,
      });
    });
  }

  async sendTransportToGarageManager(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(
      id,
      [SupplyRequestStatus.PENDING_SUPPLY_MANAGER],
      SupplyRequestType.TRANSPORT,
    );
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.SUPPLY_MANAGER,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.SENT_TO_GARAGE_MANAGER,
        request.status,
        SupplyRequestStatus.PENDING_GARAGE_MANAGER,
        dto.comment,
      ),
    );
  }

  async completeByGarageManager(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(
      id,
      [SupplyRequestStatus.PENDING_GARAGE_MANAGER],
      SupplyRequestType.TRANSPORT,
    );
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.GARAGE_MANAGER,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.COMPLETED,
        request.status,
        SupplyRequestStatus.COMPLETED,
        dto.comment,
      ),
    );
  }

  async returnToPtoByChiefEngineer(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    if (!dto.comment?.trim()) {
      throw new BadRequestException("Return comment is required");
    }

    const request = await this.ensureRequestStatus(
      id,
      [SupplyRequestStatus.PENDING_CHIEF_ENGINEER],
      SupplyRequestType.MATERIAL,
    );
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.CHIEF_ENGINEER,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.RETURNED,
        request.status,
        SupplyRequestStatus.PENDING_PTO,
        dto.comment,
      ),
    );
  }

  async attachInvoicesAndSendToDirector(
    id: string,
    files: Express.Multer.File[] | undefined,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(
      id,
      [
        SupplyRequestStatus.PENDING_SUPPLY,
        SupplyRequestStatus.RETURNED_TO_SUPPLY,
      ],
    );

    if (request.type !== SupplyRequestType.MATERIAL) {
      throw new BadRequestException(
        "Only material requests can be sent with invoices",
      );
    }

    this.ensureMaterialRequestHasActiveItems(request);

    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.SUPPLY,
    ]);
    this.ensureAssignedSupplyUser(request, actorId);

    if (!files?.length) {
      throw new BadRequestException("At least one invoice file is required");
    }

    await mkdir(this.invoiceUploadsDir, { recursive: true });

    return this.prisma.$transaction(async (tx) => {
      for (const file of files) {
        const storedName = `${randomUUID()}${extname(file.originalname)}`;
        const filePath = join(this.invoiceUploadsDir, storedName);

        await writeFile(filePath, file.buffer);

        await tx.supplyRequestInvoice.create({
          data: {
            requestId: id,
            uploadedById: actorId,
            originalName: file.originalname,
            storedName,
            mimeType: file.mimetype,
            size: file.size,
            path: filePath,
          },
        });
      }

      return this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.SENT_TO_DIRECTOR,
        request.status,
        SupplyRequestStatus.PENDING_DIRECTOR,
        dto.comment,
      );
    });
  }

  async sendMoneyToDirectorBySupply(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(
      id,
      [
        SupplyRequestStatus.PENDING_SUPPLY,
        SupplyRequestStatus.RETURNED_TO_SUPPLY,
      ],
      SupplyRequestType.MONEY,
    );
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.SUPPLY,
    ]);
    this.ensureAssignedSupplyUser(request, actorId);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.SENT_TO_DIRECTOR,
        request.status,
        SupplyRequestStatus.PENDING_DIRECTOR,
        dto.comment,
      ),
    );
  }

  async approveTransportBySupply(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    void id;
    void dto;
    void actorId;
    throw new BadRequestException(
      "Supply users must attach invoices before sending request to director",
    );

    const request = await this.ensureRequestStatus(
      id,
      [
        SupplyRequestStatus.PENDING_SUPPLY,
        SupplyRequestStatus.RETURNED_TO_SUPPLY,
      ],
      SupplyRequestType.TRANSPORT,
    );
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.SUPPLY,
    ]);
    this.ensureAssignedSupplyUser(request, actorId);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.SENT_TO_DIRECTOR,
        request.status,
        SupplyRequestStatus.PENDING_DIRECTOR,
        dto.comment,
      ),
    );
  }

  async approveByDirector(id: string, dto: RequestActionDto, actorId: string) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DIRECTOR,
    ]);
    if (request.type === SupplyRequestType.TRANSPORT) {
      throw new BadRequestException(
        "Transport requests are completed by garage manager",
      );
    }

    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.DIRECTOR,
    ]);
    this.ensureMaterialRequestHasActiveItems(request);

    return this.prisma.$transaction(async (tx) => {
      const statusUpdate = await tx.supplyRequest.updateMany({
        where: {
          id,
          status: SupplyRequestStatus.PENDING_DIRECTOR,
        },
        data: {
          status: SupplyRequestStatus.IN_PROGRESS,
        },
      });

      if (statusUpdate.count !== 1) {
        throw new BadRequestException(
          "Request is no longer pending director approval",
        );
      }

      await this.spendObjectLimitIfNeeded(tx, request);

      await tx.approvalHistory.create({
        data: {
          requestId: id,
          actorId,
          action: ApprovalAction.MARKED_IN_PROGRESS,
          fromStatus: request.status,
          toStatus: SupplyRequestStatus.IN_PROGRESS,
          comment: dto.comment,
        },
      });

      return tx.supplyRequest.findUnique({
        where: { id },
        include: this.requestInclude,
      });
    });
  }

  async returnToSupply(id: string, dto: RequestActionDto, actorId: string) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DIRECTOR,
    ]);
    if (request.type === SupplyRequestType.TRANSPORT) {
      throw new BadRequestException(
        "Transport requests are not returned by director",
      );
    }

    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.DIRECTOR,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.RETURNED,
        request.status,
        SupplyRequestStatus.RETURNED_TO_SUPPLY,
        dto.comment,
      ),
    );
  }

  async rejectByDirector(id: string, dto: RequestActionDto, actorId: string) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DIRECTOR,
    ]);
    if (request.type === SupplyRequestType.TRANSPORT) {
      throw new BadRequestException(
        "Transport requests are not rejected by director",
      );
    }

    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.DIRECTOR,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.REJECTED,
        request.status,
        SupplyRequestStatus.REJECTED,
        dto.comment,
      ),
    );
  }

  async archiveByDirector(id: string, dto: RequestActionDto, actorId: string) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DIRECTOR,
      SupplyRequestStatus.RETURNED_TO_SUPPLY,
    ]);
    if (request.type === SupplyRequestType.TRANSPORT) {
      throw new BadRequestException(
        "Transport requests are not archived by director",
      );
    }

    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.DIRECTOR,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.ARCHIVED,
        request.status,
        SupplyRequestStatus.ARCHIVED,
        dto.comment,
      ),
    );
  }

  async complete(id: string, dto: RequestActionDto, actorId: string) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.IN_PROGRESS,
    ]);
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.SUPPLY,
    ]);
    if (request.type !== SupplyRequestType.TRANSPORT) {
      this.ensureAssignedSupplyUser(request, actorId);
    }

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.COMPLETED,
        request.status,
        SupplyRequestStatus.COMPLETED,
        dto.comment,
      ),
    );
  }

  async archive(id: string, dto: RequestActionDto, actorId: string) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.COMPLETED,
    ]);
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.SUPPLY,
      UserRole.DIRECTOR,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.ARCHIVED,
        request.status,
        SupplyRequestStatus.ARCHIVED,
        dto.comment,
      ),
    );
  }

  private readonly requestInclude = {
    author: true,
    assignedSupplyUser: true,
    assignedBy: true,
    object: true,
    invoices: {
      include: { uploadedBy: true },
      orderBy: { createdAt: "asc" as const },
    },
    items: {
      include: {
        priceHistory: {
          include: { actor: true },
          orderBy: { createdAt: "desc" as const },
        },
      },
    },
    approvalHistory: {
      include: { actor: true },
      orderBy: { createdAt: "asc" as const },
    },
  };

  private async createRequestNumber(
    tx: Prisma.TransactionClient,
    prefix: string,
  ): Promise<string> {
    const now = new Date();
    const datePart = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("");
    const count = await tx.supplyRequest.count();

    return `${prefix}-${datePart}-${String(count + 1).padStart(6, "0")}`;
  }

  private async ensureUserExists(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }
  }

  private async ensureRequestStatus(
    id: string,
    statuses: SupplyRequestStatus[],
    type?: SupplyRequestType,
  ) {
    const request = await this.prisma.supplyRequest.findUnique({
      where: { id },
      include: {
        items: true,
        assignedSupplyUser: true,
        object: {
          select: {
            id: true,
            type: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException("Supply request not found");
    }

    if (!statuses.includes(request.status)) {
      throw new BadRequestException(
        `Request status ${request.status} is not allowed for this action`,
      );
    }

    if (type && request.type !== type) {
      throw new BadRequestException(
        `Request type ${request.type} is not allowed for this action`,
      );
    }

    return request;
  }

  private async ensureUserObjectAccess(userId: string, objectId: string) {
    const objectAccess = await this.prisma.userObjectAccess.findUnique({
      where: {
        userId_objectId: {
          userId,
          objectId,
        },
      },
    });

    if (!objectAccess) {
      throw new ForbiddenException("User has no access to this object");
    }
  }

  private async ensureUserObjectRole(
    userId: string,
    objectId: string,
    roles: UserRole[],
  ) {
    const objectAccess = await this.prisma.userObjectAccess.findUnique({
      where: {
        userId_objectId: {
          userId,
          objectId,
        },
      },
    });

    if (!objectAccess || !roles.includes(objectAccess.role)) {
      throw new ForbiddenException(
        "User role is not allowed for this object",
      );
    }
  }

  private async getInitialRequestRoute(
    authorId: string,
    objectId: string,
    requestType: SupplyRequestType,
  ) {
    const objectAccess = await this.prisma.userObjectAccess.findUnique({
      where: {
        userId_objectId: {
          userId: authorId,
          objectId,
        },
      },
      include: {
        object: {
          select: { type: true },
        },
      },
    });

    if (!objectAccess) {
      throw new ForbiddenException("User has no access to this object");
    }

    const status = this.getInitialRequestStatus(
      requestType,
      objectAccess.role,
      objectAccess.object.type,
    );

    return {
      status,
      comment: this.getCreatedRequestComment(requestType, status),
    };
  }

  private getInitialRequestStatus(
    requestType: SupplyRequestType,
    authorRole: UserRole,
    objectType: ObjectType,
  ) {
    if (objectType === ObjectType.WORKSHOP) {
      if (authorRole === UserRole.DEPUTY_PRODUCTION_DIRECTOR) {
        return SupplyRequestStatus.PENDING_SUPPLY_MANAGER;
      }

      if (authorRole === UserRole.SUPPLY_MANAGER) {
        return SupplyRequestStatus.PENDING_SUPPLY_MANAGER;
      }

      if (authorRole === UserRole.SUPPLY) {
        return SupplyRequestStatus.PENDING_DIRECTOR;
      }

      if (authorRole === UserRole.DIRECTOR) {
        return SupplyRequestStatus.PENDING_DIRECTOR;
      }

      return SupplyRequestStatus.PENDING_DEPUTY_PRODUCTION_DIRECTOR;
    }

    if (authorRole === UserRole.CHIEF_ENGINEER) {
      return SupplyRequestStatus.PENDING_SUPPLY_MANAGER;
    }

    if (authorRole === UserRole.SUPPLY_MANAGER) {
      return SupplyRequestStatus.PENDING_SUPPLY_MANAGER;
    }

    if (authorRole === UserRole.SUPPLY) {
      return SupplyRequestStatus.PENDING_DIRECTOR;
    }

    if (authorRole === UserRole.DIRECTOR) {
      return SupplyRequestStatus.PENDING_DIRECTOR;
    }

    if (requestType === SupplyRequestType.MATERIAL) {
      if (authorRole === UserRole.PTO) {
        return SupplyRequestStatus.PENDING_CHIEF_ENGINEER;
      }

      return SupplyRequestStatus.PENDING_PTO;
    }

    return SupplyRequestStatus.PENDING_CHIEF_ENGINEER;
  }

  private getCreatedRequestComment(
    requestType: SupplyRequestType,
    status: SupplyRequestStatus,
  ) {
    const requestLabel: Record<SupplyRequestType, string> = {
      MATERIAL: "Заявка на материалы",
      TRANSPORT: "Заявка на спец технику",
      MONEY: "Заявка на средства",
    };

    const statusLabel: Partial<Record<SupplyRequestStatus, string>> = {
      PENDING_PTO: "в ПТО",
      PENDING_CHIEF_ENGINEER: "главному инженеру",
      PENDING_DEPUTY_PRODUCTION_DIRECTOR: "заместителю директора по производству",
      PENDING_SUPPLY_MANAGER: "начальнику снабжения",
      PENDING_SUPPLY: "снабженцу",
      PENDING_DIRECTOR: "директору",
      PENDING_GARAGE_MANAGER: "заведующему гаражом",
    };

    return `${requestLabel[requestType]} создана и отправлена ${statusLabel[status] ?? "на следующий этап"}`;
  }

  private async ensureCanModifyRequestItems(
    userId: string,
    objectId: string,
    status: SupplyRequestStatus,
  ) {
    const allowedRole = this.getRequestItemEditorRole(status);

    if (!allowedRole) {
      throw new ForbiddenException(
        "Request items cannot be edited at this stage",
      );
    }

    const objectAccess = await this.prisma.userObjectAccess.findUnique({
      where: {
        userId_objectId: {
          userId,
          objectId,
        },
      },
    });

    if (!objectAccess || objectAccess.role !== allowedRole) {
      throw new ForbiddenException(
        "Only the current stage role can edit request items",
      );
    }

    return objectAccess.role;
  }

  private getRequestItemEditorRole(status: SupplyRequestStatus) {
    const roleByStatus: Partial<Record<SupplyRequestStatus, UserRole>> = {
      PENDING_PTO: UserRole.PTO,
      PENDING_CHIEF_ENGINEER: UserRole.CHIEF_ENGINEER,
      PENDING_DEPUTY_PRODUCTION_DIRECTOR:
        UserRole.DEPUTY_PRODUCTION_DIRECTOR,
      PENDING_DIRECTOR: UserRole.DIRECTOR,
    };

    return roleByStatus[status] ?? null;
  }

  private ensureAssignedSupplyUser(
    request: Awaited<ReturnType<SupplyRequestsService["ensureRequestStatus"]>>,
    actorId: string,
  ) {
    if (request.assignedSupplyUserId !== actorId) {
      throw new ForbiddenException(
        "Only the assigned supply user can process this request",
      );
    }
  }

  private ensureMaterialRequestHasActiveItems(
    request: Awaited<ReturnType<SupplyRequestsService["ensureRequestStatus"]>>,
  ) {
    if (
      request.type === SupplyRequestType.MATERIAL &&
      request.items.length < 1
    ) {
      throw new BadRequestException(
        "Material request has no active approved items",
      );
    }
  }

  private async spendObjectLimitIfNeeded(
    tx: Prisma.TransactionClient,
    request: Awaited<ReturnType<SupplyRequestsService["ensureRequestStatus"]>>,
  ) {
    void tx;
    void request;
    return;

    if (request.object.type === ObjectType.INTERNAL_DEPARTMENT) {
      return;
    }

    const limitType = this.getObjectLimitType(request.type);
    const amount = this.calculateRequestDebitAmount(request);

    if (amount.lessThanOrEqualTo(0)) {
      return;
    }

    const updatedLimits = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE "ObjectLimit"
      SET
        "spentAmount" = "spentAmount" + ${amount},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE
        "objectId" = ${request.objectId}
        AND "type" = ${limitType}::"ObjectLimitType"
        AND ("spentAmount" + ${amount}) <= "limitAmount"
      RETURNING "id"
    `;

    if (updatedLimits.length !== 1) {
      throw new BadRequestException(
        "Request amount exceeds the remaining object limit",
      );
    }
  }

  private getObjectLimitType(requestType: SupplyRequestType) {
    if (requestType === SupplyRequestType.MATERIAL) {
      return ObjectLimitType.MATERIAL;
    }

    if (requestType === SupplyRequestType.TRANSPORT) {
      return ObjectLimitType.TRANSPORT;
    }

    return ObjectLimitType.MONEY;
  }

  private calculateRequestDebitAmount(
    request: Awaited<ReturnType<SupplyRequestsService["ensureRequestStatus"]>>,
  ) {
    if (request.type === SupplyRequestType.MATERIAL) {
      return request.items.reduce((total, item) => {
        const debitPrice = item.supplierPurchasePrice ?? item.ptoLimitPrice;

        if (!debitPrice) {
          throw new BadRequestException(
            "PTO price is required before director approval",
          );
        }

        return total.add(debitPrice.mul(item.quantity));
      }, new Prisma.Decimal(0));
    }

    if (request.type === SupplyRequestType.MONEY) {
      if (!request.amount) {
        throw new BadRequestException("Money request amount is required");
      }

      return request.amount;
    }

    return request.amount ?? new Prisma.Decimal(0);
  }

  private async moveRequest(
    tx: Prisma.TransactionClient,
    requestId: string,
    actorId: string,
    action: ApprovalAction,
    fromStatus: SupplyRequestStatus,
    toStatus: SupplyRequestStatus,
    comment?: string,
  ) {
    await tx.supplyRequest.update({
      where: { id: requestId },
      data: { status: toStatus },
    });

    await tx.approvalHistory.create({
      data: {
        requestId,
        actorId,
        action,
        fromStatus,
        toStatus,
        comment,
      },
    });

    return tx.supplyRequest.findUnique({
      where: { id: requestId },
      include: this.requestInclude,
    });
  }
}
