import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import { access, mkdir, unlink, writeFile } from "fs/promises";
import { extname, join } from "path";
import {
  ApprovalAction,
  ObjectType,
  PriceField,
  Prisma,
  SupplyRequestItemFulfillmentStatus,
  SupplyRequestStatus,
  SupplyRequestType,
  UserRole,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AssignSupplyRequestDto } from "./dto/assign-supply-request.dto";
import { AssignWorkshopManagerDto } from "./dto/assign-workshop-manager.dto";
import { CompleteStorekeeperRequestDto } from "./dto/complete-storekeeper-request.dto";
import { CreateAppealSupplyRequestDto } from "./dto/create-appeal-supply-request.dto";
import { CreateBusinessTripSupplyRequestDto } from "./dto/create-business-trip-supply-request.dto";
import { CreateExpressMaterialSupplyRequestDto } from "./dto/create-express-material-supply-request.dto";
import { CreateFuelSupplyRequestDto } from "./dto/create-fuel-supply-request.dto";
import { CreateMaterialSupplyRequestDto } from "./dto/create-material-supply-request.dto";
import { CreateMoneySupplyRequestDto } from "./dto/create-money-supply-request.dto";
import { CreateProductionSupplyRequestDto } from "./dto/create-production-supply-request.dto";
import { CreateQuarrySupplyRequestDto } from "./dto/create-quarry-supply-request.dto";
import { CreateTransportSupplyRequestDto } from "./dto/create-transport-supply-request.dto";
import { DeleteSupplyRequestItemDto } from "./dto/delete-supply-request-item.dto";
import { FindSupplyRequestsDto } from "./dto/find-supply-requests.dto";
import { RequestActionDto } from "./dto/request-action.dto";
import { ReviewRequestItemsDto } from "./dto/review-request-items.dto";
import { SendToStorekeeperDto } from "./dto/send-to-storekeeper.dto";
import { SetPtoLimitPricesDto } from "./dto/set-pto-limit-prices.dto";
import { UpdateSupplyRequestItemDto } from "./dto/update-supply-request-item.dto";

type RequestRouteMap = Partial<
  Record<SupplyRequestType, Partial<Record<UserRole, SupplyRequestStatus[]>>>
>;

function normalizeUploadedFileName(fileName: string) {
  const normalizedName = fileName.trim() || "file";

  if (!/[ÃÂÐÑ]/.test(normalizedName)) {
    return normalizedName;
  }

  const decodedName = Buffer.from(normalizedName, "latin1").toString("utf8");

  return decodedName.includes("�") ? normalizedName : decodedName;
}

const SUPPLY_FINAL_ROUTE = [
  SupplyRequestStatus.PENDING_SUPPLY_MANAGER,
  SupplyRequestStatus.PENDING_SUPPLY,
  SupplyRequestStatus.PENDING_SUPPLY_MANAGER_REVIEW,
  SupplyRequestStatus.COMPLETED,
];

const TRANSPORT_START_ROUTE = [
  SupplyRequestStatus.PENDING_GARAGE_MANAGER,
  SupplyRequestStatus.PENDING_DEPUTY_TRANSPORT_DIRECTOR,
];

const CONSTRUCTION_START_ROUTE = [
  SupplyRequestStatus.PENDING_CHIEF_ENGINEER,
];

const CONSTRUCTION_WITH_PTO_START_ROUTE = [
  SupplyRequestStatus.PENDING_CHIEF_ENGINEER,
  SupplyRequestStatus.PENDING_PTO,
];

const PRODUCTION_START_ROUTE = [
  SupplyRequestStatus.PENDING_DEPUTY_PRODUCTION_DIRECTOR,
];

const MATERIAL_LIKE_WAREHOUSE_ROUTE = [
  SupplyRequestStatus.PENDING_WAREHOUSE_MANAGER,
  ...SUPPLY_FINAL_ROUTE,
];

const CONSTRUCTION_MATERIAL_LIKE_ROUTE = [
  ...CONSTRUCTION_WITH_PTO_START_ROUTE,
  ...MATERIAL_LIKE_WAREHOUSE_ROUTE,
];

const TRANSPORT_MATERIAL_LIKE_ROUTE = [
  ...TRANSPORT_START_ROUTE,
  ...MATERIAL_LIKE_WAREHOUSE_ROUTE,
];

const PRODUCTION_MATERIAL_LIKE_ROUTE = [
  ...PRODUCTION_START_ROUTE,
  ...MATERIAL_LIKE_WAREHOUSE_ROUTE,
];

const CONSTRUCTION_SUPPLY_ROUTE = [
  ...CONSTRUCTION_WITH_PTO_START_ROUTE,
  ...SUPPLY_FINAL_ROUTE,
];

const CHIEF_ENGINEER_MATERIAL_LIKE_ROUTE = [
  SupplyRequestStatus.PENDING_PTO,
  ...MATERIAL_LIKE_WAREHOUSE_ROUTE,
];

const CHIEF_ENGINEER_SUPPLY_ROUTE = [
  SupplyRequestStatus.PENDING_PTO,
  ...SUPPLY_FINAL_ROUTE,
];

const TRANSPORT_SUPPLY_ROUTE = [
  ...TRANSPORT_START_ROUTE,
  ...SUPPLY_FINAL_ROUTE,
];

const PRODUCTION_SUPPLY_ROUTE = [
  ...PRODUCTION_START_ROUTE,
  ...SUPPLY_FINAL_ROUTE,
];

const EXPRESS_MATERIAL_COMMON_ROUTE = [
  SupplyRequestStatus.PENDING_DIRECTOR,
  SupplyRequestStatus.PENDING_ACCOUNTANT,
  SupplyRequestStatus.PENDING_REQUEST_AUTHOR,
  SupplyRequestStatus.COMPLETED,
];

const REQUEST_ROUTE_CONFIG: RequestRouteMap = {
  MATERIAL: {
    MECHANIC: TRANSPORT_MATERIAL_LIKE_ROUTE,
    FOREMAN: CONSTRUCTION_MATERIAL_LIKE_ROUTE,
    SITE_MANAGER: CONSTRUCTION_MATERIAL_LIKE_ROUTE,
    CHIEF_ENGINEER: CHIEF_ENGINEER_MATERIAL_LIKE_ROUTE,
    WORKSHOP_MANAGER: PRODUCTION_MATERIAL_LIKE_ROUTE,
  },
  MONEY: {
    MECHANIC: TRANSPORT_SUPPLY_ROUTE,
    FOREMAN: CONSTRUCTION_SUPPLY_ROUTE,
    SITE_MANAGER: CONSTRUCTION_SUPPLY_ROUTE,
    CHIEF_ENGINEER: CHIEF_ENGINEER_SUPPLY_ROUTE,
    WORKSHOP_MANAGER: PRODUCTION_SUPPLY_ROUTE,
  },
  TRANSPORT: {
    FOREMAN: [
      ...CONSTRUCTION_START_ROUTE,
      ...SUPPLY_FINAL_ROUTE,
    ],
    SITE_MANAGER: [
      ...CONSTRUCTION_START_ROUTE,
      ...SUPPLY_FINAL_ROUTE,
    ],
    CHIEF_ENGINEER: SUPPLY_FINAL_ROUTE,
    WORKSHOP_MANAGER: PRODUCTION_SUPPLY_ROUTE,
  },
  FUEL: {
    MECHANIC: TRANSPORT_SUPPLY_ROUTE,
    FOREMAN: CONSTRUCTION_SUPPLY_ROUTE,
    SITE_MANAGER: CONSTRUCTION_SUPPLY_ROUTE,
    CHIEF_ENGINEER: CHIEF_ENGINEER_SUPPLY_ROUTE,
    WORKSHOP_MANAGER: PRODUCTION_SUPPLY_ROUTE,
  },
  BUSINESS_TRIP: {
    MECHANIC: TRANSPORT_SUPPLY_ROUTE,
    FOREMAN: CONSTRUCTION_SUPPLY_ROUTE,
    SITE_MANAGER: CONSTRUCTION_SUPPLY_ROUTE,
    CHIEF_ENGINEER: CHIEF_ENGINEER_SUPPLY_ROUTE,
    WORKSHOP_MANAGER: PRODUCTION_SUPPLY_ROUTE,
  },
  PRODUCTION: {
    MECHANIC: TRANSPORT_MATERIAL_LIKE_ROUTE,
    FOREMAN: CONSTRUCTION_MATERIAL_LIKE_ROUTE,
    SITE_MANAGER: CONSTRUCTION_MATERIAL_LIKE_ROUTE,
    CHIEF_ENGINEER: CHIEF_ENGINEER_MATERIAL_LIKE_ROUTE,
    WORKSHOP_MANAGER: PRODUCTION_MATERIAL_LIKE_ROUTE,
  },
  QUARRY: {
    MECHANIC: TRANSPORT_SUPPLY_ROUTE,
    FOREMAN: CONSTRUCTION_SUPPLY_ROUTE,
    SITE_MANAGER: CONSTRUCTION_SUPPLY_ROUTE,
    CHIEF_ENGINEER: CHIEF_ENGINEER_SUPPLY_ROUTE,
    WORKSHOP_MANAGER: PRODUCTION_SUPPLY_ROUTE,
  },
  EXPRESS_MATERIAL: {
    SUPPLY: EXPRESS_MATERIAL_COMMON_ROUTE,
  },
  APPEAL: {
    MECHANIC: TRANSPORT_SUPPLY_ROUTE,
    FOREMAN: CONSTRUCTION_SUPPLY_ROUTE,
    SITE_MANAGER: CONSTRUCTION_SUPPLY_ROUTE,
    CHIEF_ENGINEER: CHIEF_ENGINEER_SUPPLY_ROUTE,
    WORKSHOP_MANAGER: PRODUCTION_SUPPLY_ROUTE,
  },
};

@Injectable()
export class SupplyRequestsService {
  private readonly invoiceUploadsDir = join(
    process.cwd(),
    "uploads",
    "invoices",
  );
  private readonly attachmentUploadsDir = join(
    process.cwd(),
    "uploads",
    "attachments",
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
              orderQuantity: new Prisma.Decimal(item.quantity),
              stockQuantity: new Prisma.Decimal(0),
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

  async createQuarryRequest(
    dto: CreateQuarrySupplyRequestDto,
    authorId: string,
  ) {
    if (!dto.items?.length) {
      throw new BadRequestException("Request must contain at least one item");
    }

    const route = await this.getInitialRequestRoute(
      authorId,
      dto.objectId,
      SupplyRequestType.QUARRY,
    );

    for (const item of dto.items) {
      if (
        !item.materialName.trim() ||
        !item.measurementUnit.trim() ||
        new Prisma.Decimal(item.quantity).lte(0)
      ) {
        throw new BadRequestException(
          "Each quarry item must contain name, measurement unit and positive quantity",
        );
      }
    }

    return this.prisma.$transaction(async (tx) =>
      tx.supplyRequest.create({
        data: {
          requestNumber: await this.createRequestNumber(tx, "QRY"),
          type: SupplyRequestType.QUARRY,
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
              orderQuantity: new Prisma.Decimal(item.quantity),
              stockQuantity: new Prisma.Decimal(0),
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
      }),
    );
  }

  async createExpressMaterialRequest(
    dto: CreateExpressMaterialSupplyRequestDto,
    files: Express.Multer.File[] | undefined,
    authorId: string,
  ) {
    const items = this.parseExpressMaterialItems(dto.items);

    if (!dto.comment.trim()) {
      throw new BadRequestException(
        "Express material request must contain comment",
      );
    }

    if (!files?.length) {
      throw new BadRequestException(
        "Express material request must contain at least one invoice",
      );
    }

    const route = await this.getInitialRequestRoute(
      authorId,
      dto.objectId,
      SupplyRequestType.EXPRESS_MATERIAL,
    );

    for (const item of items) {
      if (
        !item.materialName.trim() ||
        !item.measurementUnit.trim() ||
        new Prisma.Decimal(item.quantity).lte(0)
      ) {
        throw new BadRequestException(
          "Each express material item must contain name, measurement unit and positive quantity",
        );
      }
    }

    await mkdir(this.invoiceUploadsDir, { recursive: true });

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.supplyRequest.create({
        data: {
          requestNumber: await this.createRequestNumber(tx, "EXP"),
          type: SupplyRequestType.EXPRESS_MATERIAL,
          objectId: dto.objectId,
          authorId,
          purpose: dto.comment.trim(),
          status: route.status,
          items: {
            create: items.map((item) => ({
              materialNameSnapshot: item.materialName.trim(),
              materialTypeSnapshot: "",
              measurementUnitSnapshot: item.measurementUnit.trim(),
              estimatedPriceSnapshot: new Prisma.Decimal(0),
              quantity: new Prisma.Decimal(item.quantity),
              orderQuantity: new Prisma.Decimal(item.quantity),
              stockQuantity: new Prisma.Decimal(0),
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

      for (const file of files) {
        const originalName = normalizeUploadedFileName(file.originalname);
        const storedName = `${randomUUID()}${extname(originalName)}`;
        const filePath = join(this.invoiceUploadsDir, storedName);

        await writeFile(filePath, file.buffer);

        await tx.supplyRequestInvoice.create({
          data: {
            requestId: request.id,
            uploadedById: authorId,
            originalName,
            storedName,
            mimeType: file.mimetype,
            size: file.size,
            path: filePath,
          },
        });
      }

      return tx.supplyRequest.findUnique({
        where: { id: request.id },
        include: this.requestInclude,
      });
    });
  }

  async createTransportRequest(
    dto: CreateTransportSupplyRequestDto,
    authorId: string,
  ) {
    if (
      !dto.transportType.trim() ||
      !dto.transportObjectName.trim() ||
      !dto.transportDate.trim() ||
      !dto.transportTime.trim() ||
      !dto.purpose.trim()
    ) {
      throw new BadRequestException(
        "Transport request must contain object, transport, date, time and purpose",
      );
    }

    const requestedDateTime = new Date(
      `${dto.transportDate.trim()}T${dto.transportTime.trim()}:00`,
    );

    if (
      Number.isNaN(requestedDateTime.getTime()) ||
      requestedDateTime.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        "Transport request date and time cannot be in the past",
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
          transportObjectName: dto.transportObjectName.trim(),
          transportDate: dto.transportDate.trim(),
          transportTime: dto.transportTime.trim(),
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

  async createFuelRequest(dto: CreateFuelSupplyRequestDto, authorId: string) {
    if (!dto.fuelType.trim() || !dto.purpose.trim()) {
      throw new BadRequestException(
        "Fuel request must contain fuel type and purpose",
      );
    }

    const route = await this.getInitialRequestRoute(
      authorId,
      dto.objectId,
      SupplyRequestType.FUEL,
    );

    return this.prisma.$transaction(async (tx) =>
      tx.supplyRequest.create({
        data: {
          requestNumber: await this.createRequestNumber(tx, "FUEL"),
          type: SupplyRequestType.FUEL,
          objectId: dto.objectId,
          authorId,
          transportType: dto.fuelType.trim(),
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

  async createBusinessTripRequest(
    dto: CreateBusinessTripSupplyRequestDto,
    authorId: string,
  ) {
    if (new Prisma.Decimal(dto.amount).lte(0) || !dto.purpose.trim()) {
      throw new BadRequestException(
        "Business trip request must contain positive amount and purpose",
      );
    }

    const route = await this.getInitialRequestRoute(
      authorId,
      dto.objectId,
      SupplyRequestType.BUSINESS_TRIP,
    );

    return this.prisma.$transaction(async (tx) =>
      tx.supplyRequest.create({
        data: {
          requestNumber: await this.createRequestNumber(tx, "TRIP"),
          type: SupplyRequestType.BUSINESS_TRIP,
          objectId: dto.objectId,
          authorId,
          amount: new Prisma.Decimal(dto.amount),
          paymentPurpose: dto.purpose.trim(),
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

  async createAppealRequest(
    dto: CreateAppealSupplyRequestDto,
    authorId: string,
  ) {
    if (!dto.text.trim()) {
      throw new BadRequestException("Appeal request must contain text");
    }

    const route = await this.getInitialRequestRoute(
      authorId,
      dto.objectId,
      SupplyRequestType.APPEAL,
    );

    return this.prisma.$transaction(async (tx) =>
      tx.supplyRequest.create({
        data: {
          requestNumber: await this.createRequestNumber(tx, "APL"),
          type: SupplyRequestType.APPEAL,
          objectId: dto.objectId,
          authorId,
          purpose: dto.text.trim(),
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
          paymentType: dto.paymentType,
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

  async createProductionRequest(
    dto: CreateProductionSupplyRequestDto,
    files: Express.Multer.File[] | undefined,
    authorId: string,
  ) {
    if (!dto.purpose.trim()) {
      throw new BadRequestException(
        "Production request must contain purpose",
      );
    }

    const route = await this.getInitialRequestRoute(
      authorId,
      dto.objectId,
      SupplyRequestType.PRODUCTION,
    );

    if (files?.length) {
      await mkdir(this.attachmentUploadsDir, { recursive: true });
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.supplyRequest.create({
        data: {
          requestNumber: await this.createRequestNumber(tx, "PRD"),
          type: SupplyRequestType.PRODUCTION,
          objectId: dto.objectId,
          authorId,
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
      });

      for (const file of files ?? []) {
        const originalName = normalizeUploadedFileName(file.originalname);
        const storedName = `${randomUUID()}${extname(originalName)}`;
        const filePath = join(this.attachmentUploadsDir, storedName);

        await writeFile(filePath, file.buffer);

        await tx.supplyRequestAttachment.create({
          data: {
            requestId: request.id,
            uploadedById: authorId,
            originalName,
            storedName,
            mimeType: file.mimetype,
            size: file.size,
            path: filePath,
          },
        });
      }

      return tx.supplyRequest.findUnique({
        where: { id: request.id },
        include: this.requestInclude,
      });
    });
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
      const requests = await this.prisma.supplyRequest.findMany({
        include: this.requestInclude,
        orderBy: { createdAt: "desc" },
      });

      return requests.map((request) => this.withAuthorObjectRole(request));
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
      items: items.map((request) => this.withAuthorObjectRole(request)),
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

    return this.withAuthorObjectRole(request);
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
    const filePath = await this.resolveUploadedFilePath(
      invoice.path,
      this.invoiceUploadsDir,
      invoice.storedName,
    );

    return {
      file: createReadStream(filePath),
      mimeType: invoice.mimeType,
      originalName: invoice.originalName,
    };
  }

  async findAttachmentFile(
    id: string,
    attachmentId: string,
    actorId: string,
  ) {
    const attachment = await this.prisma.supplyRequestAttachment.findFirst({
      where: {
        id: attachmentId,
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

    if (!attachment) {
      throw new NotFoundException("Attachment not found");
    }

    await this.ensureUserObjectAccess(actorId, attachment.request.objectId);
    const filePath = await this.resolveUploadedFilePath(
      attachment.path,
      this.attachmentUploadsDir,
      attachment.storedName,
    );

    return {
      file: createReadStream(filePath),
      mimeType: attachment.mimeType,
      originalName: attachment.originalName,
    };
  }

  private async resolveUploadedFilePath(
    storedPath: string,
    uploadsDir: string,
    storedName: string,
  ) {
    const fallbackPath = join(uploadsDir, storedName);

    for (const filePath of [storedPath, fallbackPath]) {
      try {
        await access(filePath);
        return filePath;
      } catch {
        // Try the next known location before reporting the file as missing.
      }
    }

    throw new NotFoundException(
      "Uploaded file is missing on the server storage",
    );
  }

  private async unlinkIfExists(filePath: string) {
    await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") {
        throw error;
      }
    });
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
      SupplyRequestStatus.PENDING_WAREHOUSE_MANAGER,
      SupplyRequestStatus.PENDING_DEPUTY_PRODUCTION_DIRECTOR,
      SupplyRequestStatus.PENDING_DIRECTOR,
      SupplyRequestStatus.PENDING_SUPPLY_MANAGER,
      SupplyRequestStatus.PENDING_SUPPLY,
      SupplyRequestStatus.PENDING_SUPPLY_MANAGER_REVIEW,
      SupplyRequestStatus.RETURNED_TO_SUPPLY,
    ]);

    if (!request.items.length) {
      throw new BadRequestException(
        "Only requests with items can be edited",
      );
    }

    const hasQuantityUpdates =
      dto.quantity !== undefined ||
      dto.orderQuantity !== undefined ||
      dto.stockQuantity !== undefined;
    const hasCashPaymentUpdates =
      dto.cashPaidAmount !== undefined ||
      dto.cashPaymentComment !== undefined;
    const hasPtoCommentUpdates = dto.ptoComment !== undefined;
    const hasChiefEngineerCommentUpdates =
      dto.chiefEngineerComment !== undefined;
    const hasSupplyManagerCommentUpdates =
      dto.supplyManagerComment !== undefined;
    const hasSupplierCommentUpdates = dto.supplierComment !== undefined;

    if (
      !hasQuantityUpdates &&
      !hasCashPaymentUpdates &&
      !hasPtoCommentUpdates &&
      !hasChiefEngineerCommentUpdates &&
      !hasSupplyManagerCommentUpdates &&
      !hasSupplierCommentUpdates
    ) {
      throw new BadRequestException("At least one item field is required");
    }

    let actorRole: UserRole;

    if (hasQuantityUpdates) {
      actorRole = await this.ensureCanModifyRequestItems(
        actorId,
        request.objectId,
        request.status,
      );
    } else if (hasCashPaymentUpdates) {
      await this.ensureUserObjectRole(actorId, request.objectId, [
        UserRole.SUPPLY,
      ]);
      this.ensureAssignedSupplyUser(request, actorId);
      actorRole = UserRole.SUPPLY;
    } else {
      const objectAccess = await this.ensureUserObjectRole(actorId, request.objectId, [
        UserRole.PTO,
        UserRole.CHIEF_ENGINEER,
        UserRole.SUPPLY,
        UserRole.SUPPLY_MANAGER,
      ]);

      if (objectAccess.role === UserRole.SUPPLY) {
        this.ensureAssignedSupplyUser(request, actorId);
      }

      actorRole = objectAccess.role;
    }

    if (
      hasPtoCommentUpdates &&
      (actorRole !== UserRole.PTO ||
        request.status !== SupplyRequestStatus.PENDING_PTO)
    ) {
      throw new BadRequestException(
        "PTO comments can be edited only by PTO at the PTO stage",
      );
    }

    if (
      hasChiefEngineerCommentUpdates &&
      (actorRole !== UserRole.CHIEF_ENGINEER ||
        request.status !== SupplyRequestStatus.PENDING_CHIEF_ENGINEER)
    ) {
      throw new BadRequestException(
        "Chief engineer comments can be edited only by chief engineer at the chief engineer stage",
      );
    }

    if (
      hasCashPaymentUpdates &&
      (request.status !== SupplyRequestStatus.PENDING_SUPPLY &&
        request.status !== SupplyRequestStatus.RETURNED_TO_SUPPLY)
    ) {
      throw new BadRequestException(
        "Cash payment fields can be edited only by supply at the supply stage",
      );
    }

    if (
      hasSupplyManagerCommentUpdates &&
      (actorRole !== UserRole.SUPPLY_MANAGER ||
        (request.status !== SupplyRequestStatus.PENDING_SUPPLY_MANAGER &&
          request.status !== SupplyRequestStatus.PENDING_SUPPLY_MANAGER_REVIEW))
    ) {
      throw new BadRequestException(
        "Supply manager comments can be edited only by supply manager at supply manager stages",
      );
    }

    if (
      hasSupplierCommentUpdates &&
      (actorRole !== UserRole.SUPPLY ||
        (request.status !== SupplyRequestStatus.PENDING_SUPPLY &&
          request.status !== SupplyRequestStatus.RETURNED_TO_SUPPLY))
    ) {
      throw new BadRequestException(
        "Supplier comments can be edited only by assigned supply user at supply stage",
      );
    }

    const requestItem = request.items.find((item) => item.id === itemId);

    if (!requestItem) {
      throw new NotFoundException("Supply request item not found");
    }

    const newQuantity =
      dto.quantity === undefined
        ? undefined
        : new Prisma.Decimal(dto.quantity);
    const newOrderQuantity =
      dto.orderQuantity === undefined
        ? undefined
        : new Prisma.Decimal(dto.orderQuantity);
    const newStockQuantity =
      dto.stockQuantity === undefined
        ? undefined
        : new Prisma.Decimal(dto.stockQuantity);
    const newCashPaidAmount =
      dto.cashPaidAmount === undefined
        ? undefined
        : new Prisma.Decimal(dto.cashPaidAmount);

    if (
      request.status === SupplyRequestStatus.PENDING_WAREHOUSE_MANAGER &&
      (dto.quantity !== undefined || dto.orderQuantity !== undefined)
    ) {
      throw new BadRequestException(
        "Warehouse manager can update only stock quantity",
      );
    }

    if (newQuantity?.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Quantity must be greater than zero");
    }

    if (newOrderQuantity?.lessThan(0)) {
      throw new BadRequestException(
        "Order quantity must be greater than or equal to zero",
      );
    }

    if (newStockQuantity?.lessThan(0)) {
      throw new BadRequestException(
        "Stock quantity must be greater than or equal to zero",
      );
    }

    if (newCashPaidAmount?.lessThan(0)) {
      throw new BadRequestException(
        "Cash paid amount must be greater than or equal to zero",
      );
    }

    if (
      (newOrderQuantity || newStockQuantity) &&
      request.status !== SupplyRequestStatus.PENDING_WAREHOUSE_MANAGER
    ) {
      throw new BadRequestException(
        "Only warehouse manager can update warehouse quantities",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.supplyRequestItem.update({
        where: { id: itemId },
        data: {
          quantity: newQuantity,
          orderQuantity: newOrderQuantity,
          stockQuantity: newStockQuantity,
          cashPaidAmount: newCashPaidAmount,
          cashPaymentComment:
            dto.cashPaymentComment === undefined
              ? undefined
              : dto.cashPaymentComment.trim() || null,
          ptoComment:
            dto.ptoComment === undefined
              ? undefined
              : dto.ptoComment.trim() || null,
          chiefEngineerComment:
            dto.chiefEngineerComment === undefined
              ? undefined
              : dto.chiefEngineerComment.trim() || null,
          supplyManagerComment:
            dto.supplyManagerComment === undefined
              ? undefined
              : dto.supplyManagerComment.trim() || null,
          supplierComment:
            dto.supplierComment === undefined
              ? undefined
              : dto.supplierComment.trim() || null,
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
            newQuantity: newQuantity?.toString(),
            oldOrderQuantity: requestItem.orderQuantity.toString(),
            newOrderQuantity: newOrderQuantity?.toString(),
            oldStockQuantity: requestItem.stockQuantity.toString(),
            newStockQuantity: newStockQuantity?.toString(),
            oldCashPaidAmount: requestItem.cashPaidAmount?.toString() ?? null,
            newCashPaidAmount: newCashPaidAmount?.toString(),
            oldCashPaymentComment: requestItem.cashPaymentComment,
            newCashPaymentComment: dto.cashPaymentComment,
            oldPtoComment: requestItem.ptoComment,
            newPtoComment: dto.ptoComment,
            oldChiefEngineerComment: requestItem.chiefEngineerComment,
            newChiefEngineerComment: dto.chiefEngineerComment,
            oldSupplyManagerComment: requestItem.supplyManagerComment,
            newSupplyManagerComment: dto.supplyManagerComment,
            oldSupplierComment: requestItem.supplierComment,
            newSupplierComment: dto.supplierComment,
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
      SupplyRequestStatus.PENDING_WAREHOUSE_MANAGER,
      SupplyRequestStatus.PENDING_DEPUTY_PRODUCTION_DIRECTOR,
      SupplyRequestStatus.PENDING_DIRECTOR,
    ]);

    const actorRole = await this.ensureCanModifyRequestItems(
      actorId,
      request.objectId,
      request.status,
    );

    if (request.status === SupplyRequestStatus.PENDING_WAREHOUSE_MANAGER) {
      throw new BadRequestException(
        "Warehouse manager cannot delete request items",
      );
    }

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

  async rejectToPreviousStep(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    if (!dto.comment?.trim()) {
      throw new BadRequestException("Reject comment is required");
    }

    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_PTO,
      SupplyRequestStatus.PENDING_CHIEF_ENGINEER,
      SupplyRequestStatus.PENDING_DEPUTY_PRODUCTION_DIRECTOR,
      SupplyRequestStatus.PENDING_DEPUTY_TRANSPORT_DIRECTOR,
      SupplyRequestStatus.PENDING_SUPPLY_MANAGER,
      SupplyRequestStatus.PENDING_SUPPLY_MANAGER_REVIEW,
      SupplyRequestStatus.PENDING_SUPPLY,
      SupplyRequestStatus.PENDING_DIRECTOR,
      SupplyRequestStatus.PENDING_ACCOUNTANT,
      SupplyRequestStatus.PENDING_GARAGE_MANAGER,
      SupplyRequestStatus.PENDING_WAREHOUSE_MANAGER,
      SupplyRequestStatus.PENDING_STOREKEEPER,
      SupplyRequestStatus.PENDING_TRANSPORT_AUTHOR,
      SupplyRequestStatus.RETURNED_TO_SUPPLY,
      SupplyRequestStatus.IN_PROGRESS,
    ]);

    await this.ensureCanProcessRequestAtCurrentStatus(request, actorId);

    const previousStatus = await this.getPreviousRouteStatusOrRejected(request);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        previousStatus === SupplyRequestStatus.REJECTED
          ? ApprovalAction.REJECTED
          : ApprovalAction.RETURNED,
        request.status,
        previousStatus,
        dto.comment,
      ),
    );
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

    const ptoTotalAmount = dto.items.reduce((total, item) => {
      const price = new Prisma.Decimal(item.ptoLimitPrice);

      return total.add(price);
    }, new Prisma.Decimal(0));

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
        this.getRouteActionForStatus(this.getNextRouteStatus(request)),
        request.status,
        this.getNextRouteStatus(request),
        dto.comment,
        {
          ptoTotalAmount: ptoTotalAmount.toString(),
        },
      );
    });
  }

  async approveByPto(id: string, dto: RequestActionDto, actorId: string) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_PTO,
    ]);

    if (request.type === SupplyRequestType.MATERIAL) {
      throw new BadRequestException(
        "Material requests must be approved with PTO prices",
      );
    }

    await this.ensureUserObjectRole(actorId, request.objectId, [UserRole.PTO]);

    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
        dto.comment,
      ),
    );
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
      request.type !== SupplyRequestType.QUARRY &&
      request.type !== SupplyRequestType.TRANSPORT &&
      request.type !== SupplyRequestType.FUEL &&
      request.type !== SupplyRequestType.BUSINESS_TRIP &&
      request.type !== SupplyRequestType.MONEY &&
      request.type !== SupplyRequestType.PRODUCTION &&
      request.type !== SupplyRequestType.APPEAL
    ) {
      throw new BadRequestException("Unsupported request type");
    }
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.CHIEF_ENGINEER,
    ]);

    const nextStatus = this.getNextRouteStatus(request);
    const action = this.getRouteActionForStatus(nextStatus);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        action,
        request.status,
        nextStatus,
        dto.comment,
      ),
    );
  }

  async approveByWarehouseManager(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_WAREHOUSE_MANAGER,
    ]);

    if (
      request.type !== SupplyRequestType.MATERIAL &&
      request.type !== SupplyRequestType.PRODUCTION
    ) {
      throw new BadRequestException(
        "Only material and production requests can be processed by warehouse manager",
      );
    }

    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.WAREHOUSE_MANAGER,
    ]);

    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
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
    );

    if (
      request.type !== SupplyRequestType.MATERIAL &&
      request.type !== SupplyRequestType.QUARRY &&
      request.type !== SupplyRequestType.TRANSPORT
    ) {
      throw new BadRequestException(
        "Only material and transport requests can be rejected by chief engineer",
      );
    }

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

      const nextStatus = this.getNextRouteStatus(request);

      return this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
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

    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
        dto.comment,
      ),
    );
  }

  async assignToWorkshopManager(
    id: string,
    dto: AssignWorkshopManagerDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(
      id,
      [SupplyRequestStatus.PENDING_DEPUTY_PRODUCTION_DIRECTOR],
      SupplyRequestType.PRODUCTION,
    );
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.DEPUTY_PRODUCTION_DIRECTOR,
    ]);
    await this.ensureUserObjectRole(dto.workshopManagerId, request.objectId, [
      UserRole.WORKSHOP_MANAGER,
    ]);

    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction(async (tx) => {
      await tx.supplyRequest.update({
        where: { id },
        data: {
          assignedWorkshopManagerId: dto.workshopManagerId,
          assignedById: actorId,
          assignedAt: new Date(),
          status: nextStatus,
        },
      });

      await tx.approvalHistory.create({
        data: {
          requestId: id,
          actorId,
          action: ApprovalAction.SENT_TO_WORKSHOP_MANAGER,
          fromStatus: request.status,
          toStatus: nextStatus,
          comment: dto.comment,
          changesJson: {
            assignedWorkshopManagerId: dto.workshopManagerId,
          },
        },
      });

      return tx.supplyRequest.findUnique({
        where: { id },
        include: this.requestInclude,
      });
    });
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

  async approveByDeputyTransportDirector(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DEPUTY_TRANSPORT_DIRECTOR,
    ]);
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.DEPUTY_TRANSPORT_DIRECTOR,
    ]);

    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
        dto.comment,
      ),
    );
  }

  async approveByAccountant(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_ACCOUNTANT,
    ]);

    if (
      request.type !== SupplyRequestType.MATERIAL &&
      request.type !== SupplyRequestType.MONEY &&
      request.type !== SupplyRequestType.EXPRESS_MATERIAL &&
      request.type !== SupplyRequestType.BUSINESS_TRIP
    ) {
      throw new BadRequestException(
        "Only material, express material, money and business trip requests can be approved by accountant",
      );
    }

    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.ACCOUNTANT,
    ]);

    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
        dto.comment,
      ),
    );
  }

  async rejectByDeputyTransportDirector(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_DEPUTY_TRANSPORT_DIRECTOR,
    ]);
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.DEPUTY_TRANSPORT_DIRECTOR,
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

    await this.ensureUserObjectRole(dto.supplyUserId, request.objectId, [
      UserRole.SUPPLY,
    ]);

    if (
      request.type !== SupplyRequestType.MATERIAL &&
      request.type !== SupplyRequestType.QUARRY &&
      request.type !== SupplyRequestType.MONEY &&
      request.type !== SupplyRequestType.TRANSPORT &&
      request.type !== SupplyRequestType.FUEL &&
      request.type !== SupplyRequestType.BUSINESS_TRIP &&
      request.type !== SupplyRequestType.PRODUCTION &&
      request.type !== SupplyRequestType.APPEAL
    ) {
      throw new BadRequestException(
        "This request type cannot be assigned to supply",
      );
    }

    this.ensureMaterialRequestHasActiveItems(request);
    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction(async (tx) => {
      await tx.supplyRequest.update({
        where: { id },
        data: {
          assignedSupplyUserId: dto.supplyUserId,
          assignedById: actorId,
          assignedAt: new Date(),
          status: nextStatus,
        },
      });

      await tx.approvalHistory.create({
        data: {
          requestId: id,
          actorId,
          action: ApprovalAction.ASSIGNED_TO_SUPPLY,
          fromStatus: request.status,
          toStatus: nextStatus,
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
      [SupplyRequestType.TRANSPORT, SupplyRequestType.QUARRY],
    );
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.SUPPLY_MANAGER,
    ]);

    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
        dto.comment,
      ),
    );
  }

  async sendMaterialToDirectorBySupplyManager(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(
      id,
      [
        SupplyRequestStatus.PENDING_SUPPLY_MANAGER,
        SupplyRequestStatus.PENDING_SUPPLY_MANAGER_REVIEW,
      ],
      [
        SupplyRequestType.MATERIAL,
        SupplyRequestType.QUARRY,
        SupplyRequestType.MONEY,
        SupplyRequestType.TRANSPORT,
        SupplyRequestType.FUEL,
        SupplyRequestType.BUSINESS_TRIP,
        SupplyRequestType.PRODUCTION,
        SupplyRequestType.APPEAL,
      ],
    );
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.SUPPLY_MANAGER,
    ]);

    if (request.type === SupplyRequestType.MATERIAL) {
      this.ensureMaterialRequestHasActiveItems(request);
    }

    if (
      request.status === SupplyRequestStatus.PENDING_SUPPLY_MANAGER &&
      request.type !== SupplyRequestType.MATERIAL
    ) {
      throw new BadRequestException(
        "Only material requests can be sent directly from supply manager to director",
      );
    }

    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
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
      [
        SupplyRequestType.TRANSPORT,
        SupplyRequestType.QUARRY,
        SupplyRequestType.FUEL,
        SupplyRequestType.MATERIAL,
        SupplyRequestType.MONEY,
        SupplyRequestType.BUSINESS_TRIP,
        SupplyRequestType.PRODUCTION,
        SupplyRequestType.APPEAL,
      ],
    );
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.GARAGE_MANAGER,
    ]);

    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
        dto.comment,
      ),
    );
  }

  async completeTransportByAuthor(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(
      id,
      [SupplyRequestStatus.PENDING_TRANSPORT_AUTHOR],
      [SupplyRequestType.TRANSPORT, SupplyRequestType.QUARRY],
    );

    if (request.authorId !== actorId) {
      throw new ForbiddenException(
        "Only the request author can confirm completion",
      );
    }

    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
        dto.comment,
      ),
    );
  }

  async approveByWorkshopManager(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(
      id,
      [SupplyRequestStatus.PENDING_WORKSHOP_MANAGER],
      SupplyRequestType.PRODUCTION,
    );
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.WORKSHOP_MANAGER,
    ]);

    if (request.assignedWorkshopManagerId !== actorId) {
      throw new ForbiddenException(
        "Only the assigned workshop manager can process this request",
      );
    }

    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
        dto.comment,
      ),
    );
  }

  async completeProductionByAuthor(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(
      id,
      [SupplyRequestStatus.PENDING_PRODUCTION_AUTHOR],
      SupplyRequestType.PRODUCTION,
    );

    if (request.authorId !== actorId) {
      throw new ForbiddenException(
        "Only the production request author can confirm completion",
      );
    }

    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
        dto.comment,
      ),
    );
  }

  async completeExpressMaterialByAuthor(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(
      id,
      [SupplyRequestStatus.PENDING_REQUEST_AUTHOR],
      SupplyRequestType.EXPRESS_MATERIAL,
    );

    if (request.authorId !== actorId) {
      throw new ForbiddenException(
        "Only the request author can confirm completion",
      );
    }

    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
        dto.comment,
      ),
    );
  }

  async completeBusinessTripByAuthor(
    id: string,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(
      id,
      [SupplyRequestStatus.PENDING_REQUEST_AUTHOR],
      SupplyRequestType.BUSINESS_TRIP,
    );

    if (request.authorId !== actorId) {
      throw new ForbiddenException(
        "Only the request author can confirm completion",
      );
    }

    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
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
      throw new BadRequestException("Reject comment is required");
    }

    const request = await this.ensureRequestStatus(
      id,
      [SupplyRequestStatus.PENDING_CHIEF_ENGINEER],
    );

    if (
      request.type !== SupplyRequestType.MATERIAL &&
      request.type !== SupplyRequestType.QUARRY &&
      request.type !== SupplyRequestType.TRANSPORT &&
      request.type !== SupplyRequestType.FUEL &&
      request.type !== SupplyRequestType.BUSINESS_TRIP &&
      request.type !== SupplyRequestType.MONEY &&
      request.type !== SupplyRequestType.PRODUCTION &&
      request.type !== SupplyRequestType.APPEAL
    ) {
      throw new BadRequestException(
          "This request type cannot be rejected by chief engineer",
      );
    }

    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.CHIEF_ENGINEER,
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
      request.type !== SupplyRequestType.QUARRY &&
      request.type !== SupplyRequestType.PRODUCTION
    ) {
      throw new BadRequestException(
        "Only item requests can be sent with invoices",
      );
    }

    this.ensureMaterialRequestHasActiveItems(request);

    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.SUPPLY,
    ]);
    this.ensureAssignedSupplyUser(request, actorId);

    if (files?.length) {
      await mkdir(this.invoiceUploadsDir, { recursive: true });
    }

    return this.prisma.$transaction(async (tx) => {
      for (const file of files ?? []) {
        const originalName = normalizeUploadedFileName(file.originalname);
        const storedName = `${randomUUID()}${extname(originalName)}`;
        const filePath = join(this.invoiceUploadsDir, storedName);

        await writeFile(filePath, file.buffer);

        await tx.supplyRequestInvoice.create({
          data: {
            requestId: id,
            uploadedById: actorId,
            originalName,
            storedName,
            mimeType: file.mimetype,
            size: file.size,
            path: filePath,
          },
        });
      }

      const nextStatus = this.getNextRouteStatus(request);

      return this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
        dto.comment,
      );
    });
  }

  async attachInvoicesBySupplyManager(
    id: string,
    files: Express.Multer.File[] | undefined,
    dto: RequestActionDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_SUPPLY_MANAGER,
      SupplyRequestStatus.PENDING_SUPPLY_MANAGER_REVIEW,
    ]);

    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.SUPPLY_MANAGER,
    ]);

    if (!files?.length) {
      throw new BadRequestException("At least one invoice file is required");
    }

    await mkdir(this.invoiceUploadsDir, { recursive: true });

    return this.prisma.$transaction(async (tx) => {
      const uploadedInvoices: Array<{ id: string; originalName: string }> = [];

      for (const file of files) {
        const originalName = normalizeUploadedFileName(file.originalname);
        const storedName = `${randomUUID()}${extname(originalName)}`;
        const filePath = join(this.invoiceUploadsDir, storedName);

        await writeFile(filePath, file.buffer);

        const invoice = await tx.supplyRequestInvoice.create({
          data: {
            requestId: id,
            uploadedById: actorId,
            originalName,
            storedName,
            mimeType: file.mimetype,
            size: file.size,
            path: filePath,
          },
        });

        uploadedInvoices.push({
          id: invoice.id,
          originalName: invoice.originalName,
        });
      }

      await tx.approvalHistory.create({
        data: {
          requestId: id,
          actorId,
          action: ApprovalAction.COMMENTED,
          fromStatus: request.status,
          toStatus: request.status,
          comment:
            dto.comment?.trim() || "Начальник снабжения прикрепил счета",
          changesJson: {
            uploadedInvoices,
          },
        },
      });

      return tx.supplyRequest.findUnique({
        where: { id },
        include: this.requestInclude,
      });
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
      [
        SupplyRequestType.MONEY,
        SupplyRequestType.TRANSPORT,
        SupplyRequestType.FUEL,
        SupplyRequestType.BUSINESS_TRIP,
        SupplyRequestType.PRODUCTION,
        SupplyRequestType.APPEAL,
      ],
    );
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.SUPPLY,
    ]);
    this.ensureAssignedSupplyUser(request, actorId);

    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
        dto.comment,
      ),
    );
  }

  async approveTransportBySupply(
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
      [
        SupplyRequestType.TRANSPORT,
        SupplyRequestType.QUARRY,
        SupplyRequestType.FUEL,
        SupplyRequestType.BUSINESS_TRIP,
        SupplyRequestType.APPEAL,
      ],
    );
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.SUPPLY,
    ]);
    this.ensureAssignedSupplyUser(request, actorId);

    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction((tx) =>
      this.moveRequest(
        tx,
        id,
        actorId,
        this.getRouteActionForStatus(nextStatus),
        request.status,
        nextStatus,
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

    const targetStatus = this.getNextRouteStatus(request);
    const action = this.getRouteActionForStatus(targetStatus);

    return this.prisma.$transaction(async (tx) => {
      const statusUpdate = await tx.supplyRequest.updateMany({
        where: {
          id,
          status: SupplyRequestStatus.PENDING_DIRECTOR,
        },
        data: {
          status: targetStatus,
        },
      });

      if (statusUpdate.count !== 1) {
        throw new BadRequestException(
          "Request is no longer pending director approval",
        );
      }

      await tx.approvalHistory.create({
        data: {
          requestId: id,
          actorId,
          action,
          fromStatus: request.status,
          toStatus: targetStatus,
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
    if (request.type !== SupplyRequestType.MATERIAL) {
      throw new BadRequestException(
        "Only material requests can be returned to supply by director",
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

  async deleteByDirector(id: string, actorId: string) {
    const request = await this.prisma.supplyRequest.findUnique({
      where: { id },
      include: {
        attachments: true,
        invoices: true,
      },
    });

    if (!request) {
      throw new NotFoundException("Supply request not found");
    }

    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.DIRECTOR,
    ]);

    const filePaths = new Set<string>();

    for (const invoice of request.invoices) {
      filePaths.add(invoice.path);
      filePaths.add(join(this.invoiceUploadsDir, invoice.storedName));
    }

    for (const attachment of request.attachments) {
      filePaths.add(attachment.path);
      filePaths.add(join(this.attachmentUploadsDir, attachment.storedName));
    }

    await this.prisma.supplyRequest.delete({
      where: { id },
    });

    await Promise.all(
      Array.from(filePaths).map((filePath) => this.unlinkIfExists(filePath)),
    );

    return { success: true };
  }

  async complete(id: string, dto: SendToStorekeeperDto, actorId: string) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.IN_PROGRESS,
    ]);
    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.SUPPLY,
    ]);
    if (request.type !== SupplyRequestType.TRANSPORT) {
      this.ensureAssignedSupplyUser(request, actorId);
    }

    if (request.type === SupplyRequestType.MATERIAL) {
      await this.ensureUserObjectRole(dto.storekeeperUserId, request.objectId, [
        UserRole.STOREKEEPER,
      ]);

      const nextStatus = this.getNextRouteStatus(request);

      return this.prisma.$transaction(async (tx) => {
        await tx.supplyRequest.update({
          where: { id },
          data: {
            assignedStorekeeperId: dto.storekeeperUserId,
          },
        });

        return this.moveRequest(
          tx,
          id,
          actorId,
          this.getRouteActionForStatus(nextStatus),
          request.status,
          nextStatus,
          dto.comment,
          {
            assignedStorekeeperId: dto.storekeeperUserId,
          },
        );
      });
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

  async completeByStorekeeper(
    id: string,
    dto: CompleteStorekeeperRequestDto,
    actorId: string,
  ) {
    const request = await this.ensureRequestStatus(id, [
      SupplyRequestStatus.PENDING_STOREKEEPER,
    ]);

    if (request.type !== SupplyRequestType.MATERIAL) {
      throw new BadRequestException(
        "Only material requests are completed by storekeeper",
      );
    }

    await this.ensureUserObjectRole(actorId, request.objectId, [
      UserRole.STOREKEEPER,
    ]);

    if (request.assignedStorekeeperId !== actorId) {
      throw new ForbiddenException(
        "Only the assigned storekeeper can complete this request",
      );
    }

    const completedItemIds = new Set(dto.completedItemIds);

    if (completedItemIds.size !== dto.completedItemIds.length) {
      throw new BadRequestException("completedItemIds must be unique");
    }

    const requestItemIds = new Set(request.items.map((item) => item.id));

    for (const itemId of completedItemIds) {
      if (!requestItemIds.has(itemId)) {
        throw new BadRequestException(
          "Completed item does not belong to request",
        );
      }
    }

    const skippedItemIds = request.items
      .filter((item) => !completedItemIds.has(item.id))
      .map((item) => item.id);
    const nextStatus = this.getNextRouteStatus(request);

    return this.prisma.$transaction(async (tx) => {
      if (dto.completedItemIds.length) {
        await tx.supplyRequestItem.updateMany({
          where: {
            requestId: id,
            id: { in: dto.completedItemIds },
          },
          data: {
            fulfillmentStatus: SupplyRequestItemFulfillmentStatus.COMPLETED,
          },
        });
      }

      await tx.supplyRequestItem.updateMany({
        where: {
          requestId: id,
          id: { notIn: dto.completedItemIds },
        },
        data: {
          fulfillmentStatus: SupplyRequestItemFulfillmentStatus.SKIPPED,
        },
      });

      return this.moveRequest(
        tx,
        id,
          actorId,
          this.getRouteActionForStatus(nextStatus),
          request.status,
          nextStatus,
          dto.comment,
          {
          completedItemIds: dto.completedItemIds,
          skippedItemIds,
        },
      );
    });
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
    author: {
      include: {
        objectAccesses: true,
      },
    },
    assignedSupplyUser: true,
    assignedStorekeeper: true,
    assignedWorkshopManager: true,
    assignedBy: true,
    object: {
      include: {
        userAccesses: {
          include: { user: true },
        },
      },
    },
    invoices: {
      include: { uploadedBy: true },
      orderBy: { createdAt: "asc" as const },
    },
    attachments: {
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

  private withAuthorObjectRole<
    T extends {
      author?: {
        objectAccesses?: Array<{ objectId: string; role: UserRole }>;
      } | null;
      authorId: string;
      object?: {
        userAccesses?: Array<{ userId: string; role: UserRole }>;
      } | null;
      objectId: string;
    },
  >(request: T) {
    const authorObjectRole =
      request.object?.userAccesses?.find(
        (access) => access.userId === request.authorId,
      )?.role ??
      request.author?.objectAccesses?.find(
        (access) => access.objectId === request.objectId,
      )?.role ??
      null;

    return {
      ...request,
      authorObjectRole,
    };
  }

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

  private async ensureRequestStatus(
    id: string,
    statuses: SupplyRequestStatus[],
    type?: SupplyRequestType | SupplyRequestType[],
  ) {
    const request = await this.prisma.supplyRequest.findUnique({
      where: { id },
      include: {
        items: true,
        assignedSupplyUser: true,
        assignedStorekeeper: true,
        assignedWorkshopManager: true,
        author: {
          include: {
            objectAccesses: true,
          },
        },
        object: {
          include: {
            userAccesses: true,
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

    const allowedTypes = Array.isArray(type) ? type : type ? [type] : null;

    if (allowedTypes && !allowedTypes.includes(request.type)) {
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

    return objectAccess;
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

    const route = this.getRequestRoute(
      requestType,
      objectAccess.role,
      objectAccess.object.type,
    );

    if (!route?.length) {
      throw new ForbiddenException(
        "User role is not allowed to create this request type",
      );
    }

    const status = route[0];

    return {
      status,
      comment: this.getCreatedRequestComment(requestType, status),
    };
  }

  private getRequestRoute(
    requestType: SupplyRequestType,
    authorRole: UserRole,
    objectType: ObjectType,
  ) {
    const route = REQUEST_ROUTE_CONFIG[requestType]?.[authorRole] ?? null;

    if (
      requestType === SupplyRequestType.MATERIAL &&
      objectType === ObjectType.WORKSHOP
    ) {
      return (
        route?.filter((status) => status !== SupplyRequestStatus.PENDING_PTO) ??
        null
      );
    }

    return route;
  }

  private getRouteStartingAfterAuthorRole(
    directionRoutes:
      | Partial<Record<UserRole, SupplyRequestStatus[]>>
      | undefined,
    authorRole: UserRole,
  ) {
    if (!directionRoutes) {
      return null;
    }

    const authorStatuses = this.getRouteStatusesForRole(authorRole);

    for (const route of Object.values(directionRoutes)) {
      if (!route) {
        continue;
      }

      for (const status of authorStatuses) {
        const authorStepIndex = route.indexOf(status);

        if (authorStepIndex >= 0 && authorStepIndex < route.length - 1) {
          return route.slice(authorStepIndex + 1);
        }
      }
    }

    return null;
  }

  private getRouteStatusesForRole(role: UserRole) {
    const statusesByRole: Partial<Record<UserRole, SupplyRequestStatus[]>> = {
      ACCOUNTANT: [SupplyRequestStatus.PENDING_ACCOUNTANT],
      CHIEF_ENGINEER: [SupplyRequestStatus.PENDING_CHIEF_ENGINEER],
      DEPUTY_PRODUCTION_DIRECTOR: [
        SupplyRequestStatus.PENDING_DEPUTY_PRODUCTION_DIRECTOR,
      ],
      DEPUTY_TRANSPORT_DIRECTOR: [
        SupplyRequestStatus.PENDING_DEPUTY_TRANSPORT_DIRECTOR,
      ],
      DIRECTOR: [SupplyRequestStatus.PENDING_DIRECTOR],
      GARAGE_MANAGER: [SupplyRequestStatus.PENDING_GARAGE_MANAGER],
      PTO: [SupplyRequestStatus.PENDING_PTO],
      STOREKEEPER: [SupplyRequestStatus.PENDING_STOREKEEPER],
      SUPPLY: [SupplyRequestStatus.PENDING_SUPPLY],
      SUPPLY_MANAGER: [
        SupplyRequestStatus.PENDING_SUPPLY_MANAGER,
        SupplyRequestStatus.PENDING_SUPPLY_MANAGER_REVIEW,
      ],
      WAREHOUSE_MANAGER: [SupplyRequestStatus.PENDING_WAREHOUSE_MANAGER],
      WORKSHOP_MANAGER: [SupplyRequestStatus.PENDING_WORKSHOP_MANAGER],
    };

    return statusesByRole[role] ?? [];
  }

  private parseExpressMaterialItems(itemsJson: string) {
    try {
      const items = JSON.parse(itemsJson) as CreateMaterialSupplyRequestDto["items"];

      if (!Array.isArray(items) || items.length < 1) {
        throw new Error("empty");
      }

      return items;
    } catch {
      throw new BadRequestException(
        "Express material request must contain valid items",
      );
    }
  }

  private getCreatedRequestComment(
    requestType: SupplyRequestType,
    status: SupplyRequestStatus,
  ) {
    const requestLabel: Record<SupplyRequestType, string> = {
      MATERIAL: "Заявка на ТМЦ",
      TRANSPORT: "Заявка на спец технику",
      MONEY: "Заявка на средства",
      PRODUCTION: "Заявка на производство",
      QUARRY: "Заявка на карьер",
      EXPRESS_MATERIAL: "Экспресс заявка ТМЦ",
      FUEL: "Заявка на топливо",
      BUSINESS_TRIP: "Заявка на командировочные",
      APPEAL: "Обращение",
    };

    const statusLabel: Partial<Record<SupplyRequestStatus, string>> = {
      PENDING_PTO: "в ПТО",
      PENDING_CHIEF_ENGINEER: "главному инженеру",
      PENDING_DEPUTY_PRODUCTION_DIRECTOR:
        "заместителю директора по производству",
      PENDING_DEPUTY_TRANSPORT_DIRECTOR:
        "заместителю директора по транспорту",
      PENDING_SUPPLY_MANAGER: "начальнику снабжения",
      PENDING_SUPPLY_MANAGER_REVIEW: "начальнику снабжения на проверку",
      PENDING_SUPPLY: "снабженцу",
      PENDING_DIRECTOR: "директору",
      PENDING_ACCOUNTANT: "бухгалтеру",
      PENDING_GARAGE_MANAGER: "заведующему гаражом",
      PENDING_WAREHOUSE_MANAGER: "начальнику складского хозяйства",
      PENDING_STOREKEEPER: "кладовщику",
      PENDING_TRANSPORT_AUTHOR: "автору заявки",
      PENDING_WORKSHOP_MANAGER: "начальнику цеха",
      PENDING_PRODUCTION_AUTHOR: "автору заявки",
      PENDING_REQUEST_AUTHOR: "автору заявки",
    };

    return `${requestLabel[requestType]} создана и отправлена ${
      statusLabel[status] ?? "на следующий этап"
    }`;
  }

  private getNextRouteStatus(
    request: Awaited<ReturnType<SupplyRequestsService["ensureRequestStatus"]>>,
  ) {
    const authorRole = this.getRequestAuthorRole(request);

    if (!authorRole) {
      throw new BadRequestException("Request author role is not defined");
    }

    const route = this.getRequestRoute(
      request.type,
      authorRole,
      request.object.type,
    );

    if (!route?.length) {
      throw new BadRequestException(
        `Approval route is not configured for type ${request.type}, author role ${authorRole}, object type ${request.object.type}`,
      );
    }

    const currentStepIndex = route.indexOf(request.status);

    if (request.status === SupplyRequestStatus.RETURNED_TO_SUPPLY) {
      const supplyStepIndex = route.indexOf(SupplyRequestStatus.PENDING_SUPPLY);

      if (supplyStepIndex >= 0 && supplyStepIndex < route.length - 1) {
        return route[supplyStepIndex + 1];
      }
    }

    if (
      currentStepIndex < 0 &&
      request.type === SupplyRequestType.MATERIAL &&
      request.object.type === ObjectType.WORKSHOP &&
      request.status === SupplyRequestStatus.PENDING_PTO
    ) {
      return SupplyRequestStatus.PENDING_SUPPLY_MANAGER;
    }

    if (currentStepIndex < 0 || currentStepIndex >= route.length - 1) {
      throw new BadRequestException(
        "Request cannot be moved to the next route step",
      );
    }

    return route[currentStepIndex + 1];
  }

  private async getPreviousRouteStatusOrRejected(
    request: Awaited<ReturnType<SupplyRequestsService["ensureRequestStatus"]>>,
  ) {
    if (request.status === SupplyRequestStatus.RETURNED_TO_SUPPLY) {
      return SupplyRequestStatus.PENDING_SUPPLY_MANAGER;
    }

    const authorRole = this.getRequestAuthorRole(request);

    if (!authorRole) {
      throw new BadRequestException("Request author role is not defined");
    }

    const route = this.getRequestRoute(
      request.type,
      authorRole,
      request.object.type,
    );

    if (!route?.length) {
      throw new BadRequestException(
        `Approval route is not configured for type ${request.type}, author role ${authorRole}, object type ${request.object.type}`,
      );
    }

    const currentStepIndex = route.indexOf(request.status);

    if (currentStepIndex < 0) {
      return this.getPreviousStatusFromApprovalHistory(request.id, request.status);
    }

    return currentStepIndex === 0
      ? SupplyRequestStatus.REJECTED
      : route[currentStepIndex - 1];
  }

  private async getPreviousStatusFromApprovalHistory(
    requestId: string,
    currentStatus: SupplyRequestStatus,
  ) {
    const lastTransitionToCurrentStatus =
      await this.prisma.approvalHistory.findFirst({
        where: {
          requestId,
          toStatus: currentStatus,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (!lastTransitionToCurrentStatus?.fromStatus) {
      return SupplyRequestStatus.REJECTED;
    }

    if (lastTransitionToCurrentStatus.fromStatus === currentStatus) {
      throw new BadRequestException(
        "Request cannot be moved to the previous route step",
      );
    }

    return lastTransitionToCurrentStatus.fromStatus;
  }

  private getRouteActionForStatus(status: SupplyRequestStatus) {
    const actionByStatus: Partial<Record<SupplyRequestStatus, ApprovalAction>> = {
      PENDING_PTO: ApprovalAction.SENT_TO_PTO,
      PENDING_CHIEF_ENGINEER: ApprovalAction.SENT_TO_CHIEF_ENGINEER,
      PENDING_DEPUTY_PRODUCTION_DIRECTOR:
      ApprovalAction.SENT_TO_SUPPLY_MANAGER,
      PENDING_DEPUTY_TRANSPORT_DIRECTOR: ApprovalAction.APPROVED,
      PENDING_SUPPLY_MANAGER: ApprovalAction.SENT_TO_SUPPLY_MANAGER,
      PENDING_SUPPLY_MANAGER_REVIEW: ApprovalAction.SENT_TO_SUPPLY_MANAGER,
      PENDING_SUPPLY: ApprovalAction.SENT_TO_SUPPLY,
      PENDING_DIRECTOR: ApprovalAction.SENT_TO_DIRECTOR,
      PENDING_ACCOUNTANT: ApprovalAction.SENT_TO_ACCOUNTANT,
      PENDING_GARAGE_MANAGER: ApprovalAction.SENT_TO_GARAGE_MANAGER,
      PENDING_WAREHOUSE_MANAGER: ApprovalAction.SENT_TO_WAREHOUSE_MANAGER,
      PENDING_STOREKEEPER: ApprovalAction.SENT_TO_STOREKEEPER,
      PENDING_TRANSPORT_AUTHOR: ApprovalAction.SENT_TO_AUTHOR,
      PENDING_WORKSHOP_MANAGER: ApprovalAction.SENT_TO_WORKSHOP_MANAGER,
      PENDING_PRODUCTION_AUTHOR: ApprovalAction.SENT_TO_AUTHOR,
      PENDING_REQUEST_AUTHOR: ApprovalAction.SENT_TO_AUTHOR,
      IN_PROGRESS: ApprovalAction.MARKED_IN_PROGRESS,
      COMPLETED: ApprovalAction.COMPLETED,
      ARCHIVED: ApprovalAction.ARCHIVED,
    };

    return actionByStatus[status] ?? ApprovalAction.APPROVED;
  }

  private getRequestAuthorRole(
    request: Awaited<ReturnType<SupplyRequestsService["ensureRequestStatus"]>>,
  ) {
    return (
      request.object.userAccesses.find(
        (access) => access.userId === request.authorId,
      )?.role ??
      request.author.objectAccesses.find(
        (access) => access.objectId === request.objectId,
      )?.role ??
      null
    );
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

  private async ensureCanProcessRequestAtCurrentStatus(
    request: Awaited<ReturnType<SupplyRequestsService["ensureRequestStatus"]>>,
    actorId: string,
  ) {
    if (
      request.status === SupplyRequestStatus.PENDING_TRANSPORT_AUTHOR ||
      request.status === SupplyRequestStatus.PENDING_PRODUCTION_AUTHOR ||
      request.status === SupplyRequestStatus.PENDING_REQUEST_AUTHOR
    ) {
      if (request.authorId !== actorId) {
        throw new ForbiddenException(
          "Only the request author can process this request",
        );
      }

      return;
    }

    if (
      request.status === SupplyRequestStatus.PENDING_SUPPLY ||
      request.status === SupplyRequestStatus.RETURNED_TO_SUPPLY ||
      request.status === SupplyRequestStatus.IN_PROGRESS
    ) {
      await this.ensureUserObjectRole(actorId, request.objectId, [
        UserRole.SUPPLY,
      ]);
      this.ensureAssignedSupplyUser(request, actorId);
      return;
    }

    const roleByStatus: Partial<Record<SupplyRequestStatus, UserRole>> = {
      PENDING_PTO: UserRole.PTO,
      PENDING_CHIEF_ENGINEER: UserRole.CHIEF_ENGINEER,
      PENDING_DEPUTY_PRODUCTION_DIRECTOR:
        UserRole.DEPUTY_PRODUCTION_DIRECTOR,
      PENDING_DEPUTY_TRANSPORT_DIRECTOR: UserRole.DEPUTY_TRANSPORT_DIRECTOR,
      PENDING_SUPPLY_MANAGER: UserRole.SUPPLY_MANAGER,
      PENDING_SUPPLY_MANAGER_REVIEW: UserRole.SUPPLY_MANAGER,
      PENDING_DIRECTOR: UserRole.DIRECTOR,
      PENDING_ACCOUNTANT: UserRole.ACCOUNTANT,
      PENDING_GARAGE_MANAGER: UserRole.GARAGE_MANAGER,
      PENDING_WAREHOUSE_MANAGER: UserRole.WAREHOUSE_MANAGER,
      PENDING_STOREKEEPER: UserRole.STOREKEEPER,
      PENDING_WORKSHOP_MANAGER: UserRole.WORKSHOP_MANAGER,
    };

    const role = roleByStatus[request.status];

    if (!role) {
      throw new ForbiddenException(
        "Request cannot be processed at this stage",
      );
    }

    await this.ensureUserObjectRole(actorId, request.objectId, [role]);

    if (
      request.status === SupplyRequestStatus.PENDING_STOREKEEPER &&
      request.assignedStorekeeperId !== actorId
    ) {
      throw new ForbiddenException(
        "Only the assigned storekeeper can process this request",
      );
    }

    if (
      request.status === SupplyRequestStatus.PENDING_WORKSHOP_MANAGER &&
      request.assignedWorkshopManagerId !== actorId
    ) {
      throw new ForbiddenException(
        "Only the assigned workshop manager can process this request",
      );
    }
  }

  private getRequestItemEditorRole(status: SupplyRequestStatus) {
    const roleByStatus: Partial<Record<SupplyRequestStatus, UserRole>> = {
      PENDING_PTO: UserRole.PTO,
      PENDING_CHIEF_ENGINEER: UserRole.CHIEF_ENGINEER,
      PENDING_WAREHOUSE_MANAGER: UserRole.WAREHOUSE_MANAGER,
      PENDING_DEPUTY_PRODUCTION_DIRECTOR:
        UserRole.DEPUTY_PRODUCTION_DIRECTOR,
      PENDING_DEPUTY_TRANSPORT_DIRECTOR: UserRole.DEPUTY_TRANSPORT_DIRECTOR,
      PENDING_DIRECTOR: UserRole.DIRECTOR,
      PENDING_ACCOUNTANT: UserRole.ACCOUNTANT,
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
      (request.type === SupplyRequestType.MATERIAL ||
        request.type === SupplyRequestType.QUARRY ||
        request.type === SupplyRequestType.EXPRESS_MATERIAL) &&
      request.items.length < 1
    ) {
      throw new BadRequestException(
        "Request has no active approved items",
      );
    }
  }

  private getMaterialPtoTotalAmount(
    request: Awaited<ReturnType<SupplyRequestsService["ensureRequestStatus"]>>,
  ) {
    return request.items.reduce((total, item) => {
      if (!item.ptoLimitPrice) {
        throw new BadRequestException(
          "PTO price must be provided before sending material request to director",
        );
      }

      return total.add(item.ptoLimitPrice);
    }, new Prisma.Decimal(0));
  }

  private async moveRequest(
    tx: Prisma.TransactionClient,
    requestId: string,
    actorId: string,
    action: ApprovalAction,
    fromStatus: SupplyRequestStatus,
    toStatus: SupplyRequestStatus,
    comment?: string,
    changesJson?: Prisma.InputJsonValue,
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
        changesJson,
      },
    });

    return tx.supplyRequest.findUnique({
      where: { id: requestId },
      include: this.requestInclude,
    });
  }
}
