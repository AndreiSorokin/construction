import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import { mkdir, writeFile } from "fs/promises";
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
import { SetPtoLimitPricesDto } from "./dto/set-pto-limit-prices.dto";
import { SetSupplierPurchasePricesDto } from "./dto/set-supplier-purchase-prices.dto";
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

    await this.ensureUserObjectRole(authorId, dto.objectId, [
      UserRole.FOREMAN,
    ]);

    const materialIds = dto.items.map((item) => item.objectMaterialId);
    const materials = await this.prisma.objectMaterial.findMany({
      where: {
        id: { in: materialIds },
        objectId: dto.objectId,
      },
    });

    if (materials.length !== new Set(materialIds).size) {
      throw new BadRequestException(
        "All materials must belong to the selected object",
      );
    }

    const materialsById = new Map(
      materials.map((material) => [material.id, material]),
    );

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.supplyRequest.create({
        data: {
          requestNumber: await this.createRequestNumber(tx, "MAT"),
          type: SupplyRequestType.MATERIAL,
          objectId: dto.objectId,
          authorId,
          status: SupplyRequestStatus.PENDING_PTO,
          items: {
            create: dto.items.map((item) => {
              const material = materialsById.get(item.objectMaterialId);

              if (!material) {
                throw new BadRequestException("Material not found");
              }

              return {
                objectMaterialId: material.id,
                materialNameSnapshot: material.name,
                materialTypeSnapshot: material.type,
                measurementUnitSnapshot: material.measurementUnit,
                estimatedPriceSnapshot: material.estimatedPrice,
                quantity: new Prisma.Decimal(item.quantity),
              };
            }),
          },
          approvalHistory: {
            create: {
              actorId: authorId,
              action: ApprovalAction.CREATED,
              fromStatus: null,
              toStatus: SupplyRequestStatus.PENDING_PTO,
              comment: "Заявка на материалы создана и отправлена в ПТО",
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
    await this.ensureUserObjectRole(authorId, dto.objectId, [
      UserRole.SITE_MANAGER,
    ]);

    return this.prisma.$transaction(async (tx) =>
      tx.supplyRequest.create({
        data: {
          requestNumber: await this.createRequestNumber(tx, "TRN"),
          type: SupplyRequestType.TRANSPORT,
          objectId: dto.objectId,
          authorId,
          transportType: dto.transportType,
          purpose: dto.purpose,
          status: SupplyRequestStatus.PENDING_SUPPLY_MANAGER,
          approvalHistory: {
            create: {
              actorId: authorId,
              action: ApprovalAction.CREATED,
              fromStatus: null,
              toStatus: SupplyRequestStatus.PENDING_SUPPLY_MANAGER,
              comment: "Заявка на транспорт создана и отправлена в снабжение",
            },
          },
        },
        include: this.requestInclude,
      }),
    );
  }

  async createMoneyRequest(dto: CreateMoneySupplyRequestDto, authorId: string) {
    await this.ensureUserObjectRole(authorId, dto.objectId, [
      UserRole.SITE_MANAGER,
    ]);

    return this.prisma.$transaction(async (tx) =>
      tx.supplyRequest.create({
        data: {
          requestNumber: await this.createRequestNumber(tx, "MON"),
          type: SupplyRequestType.MONEY,
          objectId: dto.objectId,
          authorId,
          amount: new Prisma.Decimal(dto.amount),
          paymentPurpose: dto.paymentPurpose,
          status: SupplyRequestStatus.PENDING_DIRECTOR,
          approvalHistory: {
            create: {
              actorId: authorId,
              action: ApprovalAction.CREATED,
              fromStatus: null,
              toStatus: SupplyRequestStatus.PENDING_DIRECTOR,
              comment: "Заявка на деньги создана и отправлена директору",
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

  async updateRequestItem(
    id: string,
    itemId: string,
    dto: UpdateSupplyRequestItemDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_PTO,
      SupplyRequestStatus.PENDING_CHIEF_ENGINEER,
      SupplyRequestStatus.PENDING_SUPPLY_MANAGER,
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
      SupplyRequestStatus.PENDING_SUPPLY_MANAGER,
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
        ApprovalAction.SENT_TO_SUPPLY_MANAGER,
        request.status,
        SupplyRequestStatus.PENDING_SUPPLY_MANAGER,
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
    await this.ensureUserObjectRole(dto.supplyUserId, request.objectId, [
      UserRole.SUPPLY,
    ]);

    if (
      request.type !== SupplyRequestType.MATERIAL &&
      request.type !== SupplyRequestType.TRANSPORT
    ) {
      throw new BadRequestException(
        "Only material and transport requests can be assigned to supply",
      );
    }

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

  async setSupplierPurchasePrices(
    id: string,
    dto: SetSupplierPurchasePricesDto,
    actorId: string,
  ) {
    void id;
    void dto;
    void actorId;
    throw new BadRequestException(
      "Supply users must attach invoices instead of entering purchase prices",
    );

    const request = await this.ensureRequestStatus(
      id,
      [
        SupplyRequestStatus.PENDING_SUPPLY,
        SupplyRequestStatus.RETURNED_TO_SUPPLY,
      ],
      SupplyRequestType.MATERIAL,
    );
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.SUPPLY,
    ]);
    this.ensureAssignedSupplyUser(request, actorId);

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

        const newValue = new Prisma.Decimal(item.supplierPurchasePrice);

        await tx.requestPriceHistory.create({
          data: {
            requestItemId: requestItem.id,
            actorId,
            field: PriceField.SUPPLIER_PURCHASE_PRICE,
            oldValue: requestItem.supplierPurchasePrice,
            newValue,
          },
        });

        await tx.supplyRequestItem.update({
          where: { id: requestItem.id },
          data: { supplierPurchasePrice: newValue },
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

    if (
      request.type !== SupplyRequestType.MATERIAL &&
      request.type !== SupplyRequestType.TRANSPORT
    ) {
      throw new BadRequestException(
        "Only material and transport requests can be sent with invoices",
      );
    }

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
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.DIRECTOR,
    ]);

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
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.DIRECTOR,
    ]);

    if (request.type === SupplyRequestType.MONEY) {
      throw new BadRequestException(
        "Money request cannot be returned to supply",
      );
    }

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
        SupplyRequestStatus.RETURNED_TO_SUPPLY,
        dto.comment,
      ),
    );
  }

  async archiveByDirector(id: string, dto: RequestActionDto, actorId: string) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DIRECTOR,
      SupplyRequestStatus.RETURNED_TO_SUPPLY,
    ]);
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
    if (
      request.type === SupplyRequestType.MATERIAL ||
      request.type === SupplyRequestType.TRANSPORT
    ) {
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
        objectMaterial: true,
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

  private async spendObjectLimitIfNeeded(
    tx: Prisma.TransactionClient,
    request: Awaited<ReturnType<SupplyRequestsService["ensureRequestStatus"]>>,
  ) {
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
