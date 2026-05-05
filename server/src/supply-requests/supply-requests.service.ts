import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ApprovalAction,
  PriceField,
  Prisma,
  SupplyRequestStatus,
  SupplyRequestType,
  UserRole,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMaterialSupplyRequestDto } from "./dto/create-material-supply-request.dto";
import { CreateMoneySupplyRequestDto } from "./dto/create-money-supply-request.dto";
import { CreateTransportSupplyRequestDto } from "./dto/create-transport-supply-request.dto";
import { FindSupplyRequestsDto } from "./dto/find-supply-requests.dto";
import { RequestActionDto } from "./dto/request-action.dto";
import { SetPtoLimitPricesDto } from "./dto/set-pto-limit-prices.dto";
import { SetSupplierPurchasePricesDto } from "./dto/set-supplier-purchase-prices.dto";

@Injectable()
export class SupplyRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createMaterialRequest(
    dto: CreateMaterialSupplyRequestDto,
    authorId: string,
  ) {
    if (!dto.items?.length) {
      throw new BadRequestException("Request must contain at least one item");
    }

    const author = await this.ensureUserWithRole(authorId, [UserRole.FOREMAN]);

    const objectAccess = await this.prisma.userObjectAccess.findUnique({
      where: {
        userId_objectId: {
          userId: author.id,
          objectId: dto.objectId,
        },
      },
    });

    if (!objectAccess) {
      throw new ForbiddenException("User has no access to this object");
    }

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
    const author = await this.ensureUserWithRole(authorId, [
      UserRole.SITE_MANAGER,
    ]);

    await this.ensureUserObjectAccess(author.id, dto.objectId);

    return this.prisma.$transaction(async (tx) =>
      tx.supplyRequest.create({
        data: {
          requestNumber: await this.createRequestNumber(tx, "TRN"),
          type: SupplyRequestType.TRANSPORT,
          objectId: dto.objectId,
          authorId,
          transportType: dto.transportType,
          purpose: dto.purpose,
          status: SupplyRequestStatus.PENDING_SUPPLY,
          approvalHistory: {
            create: {
              actorId: authorId,
              action: ApprovalAction.CREATED,
              fromStatus: null,
              toStatus: SupplyRequestStatus.PENDING_SUPPLY,
              comment: "Заявка на транспорт создана и отправлена в снабжение",
            },
          },
        },
        include: this.requestInclude,
      }),
    );
  }

  async createMoneyRequest(dto: CreateMoneySupplyRequestDto, authorId: string) {
    await this.ensureUserExists(authorId);
    await this.ensureUserObjectAccess(authorId, dto.objectId);

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

  async setPtoLimitPrices(
    id: string,
    dto: SetPtoLimitPricesDto,
    actorId: string,
  ) {
    await this.ensureUserWithRole(actorId, [UserRole.PTO]);
    const request = await this.ensureRequestStatus(
      id,
      [SupplyRequestStatus.PENDING_PTO],
      SupplyRequestType.MATERIAL,
    );

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
    await this.ensureUserWithRole(actorId, [UserRole.CHIEF_ENGINEER]);
    const request = await this.ensureRequestStatus(
      id,
      [SupplyRequestStatus.PENDING_CHIEF_ENGINEER],
      SupplyRequestType.MATERIAL,
    );

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.SENT_TO_SUPPLY,
        request.status,
        SupplyRequestStatus.PENDING_SUPPLY,
        dto.comment,
      ),
    );
  }

  async returnToPtoByChiefEngineer(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    await this.ensureUserWithRole(actorId, [UserRole.CHIEF_ENGINEER]);

    if (!dto.comment?.trim()) {
      throw new BadRequestException("Return comment is required");
    }

    const request = await this.ensureRequestStatus(
      id,
      [SupplyRequestStatus.PENDING_CHIEF_ENGINEER],
      SupplyRequestType.MATERIAL,
    );

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
    await this.ensureUserWithRole(actorId, [UserRole.SUPPLY]);
    const request = await this.ensureRequestStatus(
      id,
      [
        SupplyRequestStatus.PENDING_SUPPLY,
        SupplyRequestStatus.RETURNED_TO_SUPPLY,
      ],
      SupplyRequestType.MATERIAL,
    );

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

  async approveTransportBySupply(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    await this.ensureUserWithRole(actorId, [UserRole.SUPPLY]);
    const request = await this.ensureRequestStatus(
      id,
      [
        SupplyRequestStatus.PENDING_SUPPLY,
        SupplyRequestStatus.RETURNED_TO_SUPPLY,
      ],
      SupplyRequestType.TRANSPORT,
    );

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
    await this.ensureUserWithRole(actorId, [UserRole.DIRECTOR]);
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DIRECTOR,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        ApprovalAction.MARKED_IN_PROGRESS,
        request.status,
        SupplyRequestStatus.IN_PROGRESS,
        dto.comment,
      ),
    );
  }

  async returnToSupply(id: string, dto: RequestActionDto, actorId: string) {
    await this.ensureUserWithRole(actorId, [UserRole.DIRECTOR]);
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DIRECTOR,
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
    await this.ensureUserWithRole(actorId, [UserRole.DIRECTOR]);
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DIRECTOR,
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
    await this.ensureUserWithRole(actorId, [UserRole.DIRECTOR]);
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DIRECTOR,
      SupplyRequestStatus.RETURNED_TO_SUPPLY,
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
    await this.ensureUserWithRole(actorId, [UserRole.SUPPLY]);
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.IN_PROGRESS,
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

  async archive(id: string, dto: RequestActionDto, actorId: string) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.COMPLETED,
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
    object: true,
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

  private async ensureUserWithRole(id: string, roles: UserRole[]) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!user.role || !roles.includes(user.role)) {
      throw new ForbiddenException("User role is not allowed for this action");
    }

    return user;
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
      include: { items: true },
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
