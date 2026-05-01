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
  UserRole,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMaterialSupplyRequestDto } from "./dto/create-material-supply-request.dto";
import { RequestActionDto } from "./dto/request-action.dto";
import { SetPtoLimitPricesDto } from "./dto/set-pto-limit-prices.dto";
import { SetSupplierPurchasePricesDto } from "./dto/set-supplier-purchase-prices.dto";

@Injectable()
export class SupplyRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createMaterialRequest(dto: CreateMaterialSupplyRequestDto) {
    if (!dto.items?.length) {
      throw new BadRequestException("Request must contain at least one item");
    }

    const author = await this.ensureUserWithRole(dto.authorId, [
      UserRole.FOREMAN,
      UserRole.SITE_MANAGER,
    ]);

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
        isActive: true,
      },
    });

    if (materials.length !== new Set(materialIds).size) {
      throw new BadRequestException(
        "All materials must be active and belong to the selected object",
      );
    }

    const materialsById = new Map(
      materials.map((material) => [material.id, material]),
    );

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.supplyRequest.create({
        data: {
          requestNumber: await this.createRequestNumber(tx),
          objectId: dto.objectId,
          authorId: dto.authorId,
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
              actorId: dto.authorId,
              action: ApprovalAction.CREATED,
              fromStatus: null,
              toStatus: SupplyRequestStatus.PENDING_PTO,
              comment: "Material supply request created and sent to PTO",
            },
          },
        },
        include: this.requestInclude,
      });

      return request;
    });
  }

  findAll() {
    return this.prisma.supplyRequest.findMany({
      include: this.requestInclude,
      orderBy: { createdAt: "desc" },
    });
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

  async setPtoLimitPrices(id: string, dto: SetPtoLimitPricesDto) {
    await this.ensureUserWithRole(dto.actorId, [UserRole.PTO]);
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_PTO,
    ]);

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
            actorId: dto.actorId,
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
        dto.actorId,
        ApprovalAction.SENT_TO_CHIEF_ENGINEER,
        request.status,
        SupplyRequestStatus.PENDING_CHIEF_ENGINEER,
        dto.comment,
      );
    });
  }

  async approveByChiefEngineer(id: string, dto: RequestActionDto) {
    await this.ensureUserWithRole(dto.actorId, [UserRole.CHIEF_ENGINEER]);
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_CHIEF_ENGINEER,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        dto.actorId,
        ApprovalAction.SENT_TO_SUPPLY,
        request.status,
        SupplyRequestStatus.PENDING_SUPPLY,
        dto.comment,
      ),
    );
  }

  async setSupplierPurchasePrices(
    id: string,
    dto: SetSupplierPurchasePricesDto,
  ) {
    await this.ensureUserWithRole(dto.actorId, [UserRole.SUPPLY]);
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_SUPPLY,
      SupplyRequestStatus.RETURNED_TO_SUPPLY,
    ]);

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
            actorId: dto.actorId,
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
        dto.actorId,
        ApprovalAction.SENT_TO_DIRECTOR,
        request.status,
        SupplyRequestStatus.PENDING_DIRECTOR,
        dto.comment,
      );
    });
  }

  async approveByDirector(id: string, dto: RequestActionDto) {
    await this.ensureUserWithRole(dto.actorId, [UserRole.DIRECTOR]);
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DIRECTOR,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        dto.actorId,
        ApprovalAction.MARKED_IN_PROGRESS,
        request.status,
        SupplyRequestStatus.IN_PROGRESS,
        dto.comment,
      ),
    );
  }

  async returnToSupply(id: string, dto: RequestActionDto) {
    await this.ensureUserWithRole(dto.actorId, [UserRole.DIRECTOR]);
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DIRECTOR,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        dto.actorId,
        ApprovalAction.RETURNED,
        request.status,
        SupplyRequestStatus.RETURNED_TO_SUPPLY,
        dto.comment,
      ),
    );
  }

  async rejectByDirector(id: string, dto: RequestActionDto) {
    await this.ensureUserWithRole(dto.actorId, [UserRole.DIRECTOR]);
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DIRECTOR,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        dto.actorId,
        ApprovalAction.REJECTED,
        request.status,
        SupplyRequestStatus.RETURNED_TO_SUPPLY,
        dto.comment,
      ),
    );
  }

  async archiveByDirector(id: string, dto: RequestActionDto) {
    await this.ensureUserWithRole(dto.actorId, [UserRole.DIRECTOR]);
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DIRECTOR,
      SupplyRequestStatus.RETURNED_TO_SUPPLY,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        dto.actorId,
        ApprovalAction.ARCHIVED,
        request.status,
        SupplyRequestStatus.ARCHIVED,
        dto.comment,
      ),
    );
  }

  async complete(id: string, dto: RequestActionDto) {
    await this.ensureUserWithRole(dto.actorId, [UserRole.SUPPLY]);
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.IN_PROGRESS,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        dto.actorId,
        ApprovalAction.COMPLETED,
        request.status,
        SupplyRequestStatus.COMPLETED,
        dto.comment,
      ),
    );
  }

  async archive(id: string, dto: RequestActionDto) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.COMPLETED,
    ]);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        dto.actorId,
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
  ): Promise<string> {
    const now = new Date();
    const datePart = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("");
    const count = await tx.supplyRequest.count();

    return `MAT-${datePart}-${String(count + 1).padStart(6, "0")}`;
  }

  private async ensureUserWithRole(id: string, roles: UserRole[]) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!roles.includes(user.role)) {
      throw new ForbiddenException("User role is not allowed for this action");
    }

    return user;
  }

  private async ensureRequestStatus(
    id: string,
    statuses: SupplyRequestStatus[],
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

    return request;
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
