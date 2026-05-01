import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, UserObjectRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AddObjectAccessDto } from "./dto/add-object-access.dto";
import { CreateObjectMaterialDto } from "./dto/create-object-material.dto";
import { CreateObjectDto } from "./dto/create-object.dto";
import { UpdateObjectMaterialDto } from "./dto/update-object-material.dto";

@Injectable()
export class ObjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateObjectDto) {
    await this.ensureUserExists(dto.ownerId);

    return this.prisma.$transaction(async (tx) => {
      const object = await tx.objectEntity.create({
        data: {
          name: dto.name,
          type: dto.type,
          closingLimit: new Prisma.Decimal(dto.closingLimit),
          ownerId: dto.ownerId,
        },
      });

      await tx.userObjectAccess.create({
        data: {
          objectId: object.id,
          userId: dto.ownerId,
          role: UserObjectRole.OWNER,
        },
      });

      return object;
    });
  }

  findAll() {
    return this.prisma.objectEntity.findMany({
      include: {
        owner: true,
        materials: true,
        userAccesses: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const object = await this.prisma.objectEntity.findUnique({
      where: { id },
      include: {
        owner: true,
        materials: true,
        userAccesses: {
          include: { user: true },
        },
      },
    });

    if (!object) {
      throw new NotFoundException("Object not found");
    }

    return object;
  }

  async addAccess(objectId: string, dto: AddObjectAccessDto) {
    await this.ensureObjectExists(objectId);
    await this.ensureUserExists(dto.userId);

    return this.prisma.userObjectAccess.upsert({
      where: {
        userId_objectId: {
          userId: dto.userId,
          objectId,
        },
      },
      create: {
        userId: dto.userId,
        objectId,
        role: dto.role ?? UserObjectRole.VIEWER,
      },
      update: {
        role: dto.role ?? UserObjectRole.VIEWER,
      },
    });
  }

  async createMaterial(objectId: string, dto: CreateObjectMaterialDto) {
    await this.ensureObjectExists(objectId);

    return this.prisma.objectMaterial.create({
      data: {
        objectId,
        name: dto.name,
        type: dto.type,
        measurementUnit: dto.measurementUnit,
        estimatedPrice: new Prisma.Decimal(dto.estimatedPrice),
      },
    });
  }

  async findMaterials(objectId: string) {
    await this.ensureObjectExists(objectId);

    return this.prisma.objectMaterial.findMany({
      where: { objectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateMaterial(
    objectId: string,
    materialId: string,
    dto: UpdateObjectMaterialDto,
  ) {
    const material = await this.prisma.objectMaterial.findFirst({
      where: { id: materialId, objectId },
    });

    if (!material) {
      throw new NotFoundException("Object material not found");
    }

    if (dto.estimatedPrice !== undefined && Number(dto.estimatedPrice) < 0) {
      throw new BadRequestException("estimatedPrice must be positive");
    }

    return this.prisma.objectMaterial.update({
      where: { id: materialId },
      data: {
        name: dto.name,
        type: dto.type,
        measurementUnit: dto.measurementUnit,
        estimatedPrice:
          dto.estimatedPrice === undefined
            ? undefined
            : new Prisma.Decimal(dto.estimatedPrice),
        isActive: dto.isActive,
      },
    });
  }

  private async ensureObjectExists(id: string) {
    const object = await this.prisma.objectEntity.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!object) {
      throw new NotFoundException("Object not found");
    }
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
}
