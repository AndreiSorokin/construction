import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import { ObjectLimitType, ObjectType, Prisma, UserRole } from "@prisma/client";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { AddObjectAccessDto } from "./dto/add-object-access.dto";
import { CreateObjectMaterialDto } from "./dto/create-object-material.dto";
import { CreateObjectDto } from "./dto/create-object.dto";
import { InviteUserDto } from "./dto/invite-user.dto";
import { UpdateObjectMaterialDto } from "./dto/update-object-material.dto";

@Injectable()
export class ObjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateObjectDto, ownerId: string) {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true },
    });

    if (!owner) {
      throw new NotFoundException("User not found");
    }

    return this.prisma.$transaction(async (tx) => {
      const object = await tx.objectEntity.create({
        data: {
          name: dto.name,
          type: dto.type,
          ownerId,
          limits:
            dto.type === ObjectType.CONSTRUCTION_OBJECT
              ? {
                  create: [
                    {
                      type: ObjectLimitType.MATERIAL,
                      limitAmount: new Prisma.Decimal(dto.materialsLimit ?? 0),
                    },
                    {
                      type: ObjectLimitType.TRANSPORT,
                      limitAmount: new Prisma.Decimal(dto.transportLimit ?? 0),
                    },
                    {
                      type: ObjectLimitType.MONEY,
                      limitAmount: new Prisma.Decimal(dto.moneyLimit ?? 0),
                    },
                  ],
                }
              : undefined,
        },
        include: {
          limits: true,
        },
      });

      await tx.userObjectAccess.create({
        data: {
          objectId: object.id,
          userId: ownerId,
          role: UserRole.DIRECTOR,
        },
      });

      return object;
    });
  }

  findAll() {
    return this.prisma.objectEntity.findMany({
      include: {
        owner: true,
        limits: true,
        materials: true,
        userAccesses: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  findMine(userId: string) {
    return this.prisma.userObjectAccess.findMany({
      where: { userId },
      include: {
        object: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            materials: true,
            limits: true,
            userAccesses: {
              include: { user: true },
            },
          },
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
        limits: true,
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

  async addAccess(objectId: string, dto: AddObjectAccessDto, actorId: string) {
    await this.ensureObjectExists(objectId);
    await this.ensureUserObjectRole(actorId, objectId, [UserRole.DIRECTOR]);
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
        role: dto.role,
      },
      update: {
        role: dto.role,
      },
    });
  }

  async updateAccessRole(
    objectId: string,
    userId: string,
    role: UserRole,
    actorId: string,
  ) {
    const object = await this.prisma.objectEntity.findUnique({
      where: { id: objectId },
      select: { id: true, ownerId: true },
    });

    if (!object) {
      throw new NotFoundException("Object not found");
    }

    await this.ensureUserObjectRole(actorId, objectId, [UserRole.DIRECTOR]);

    if (actorId === userId) {
      throw new BadRequestException("You cannot change your own object role");
    }

    if (object.ownerId === userId) {
      throw new BadRequestException("Object owner role cannot be changed");
    }

    const access = await this.prisma.userObjectAccess.findUnique({
      where: {
        userId_objectId: {
          userId,
          objectId,
        },
      },
    });

    if (!access) {
      throw new NotFoundException("Object access not found");
    }

    return this.prisma.userObjectAccess.update({
      where: {
        userId_objectId: {
          userId,
          objectId,
        },
      },
      data: { role },
      include: { user: true },
    });
  }

  async deleteAccess(objectId: string, userId: string, actorId: string) {
    const object = await this.prisma.objectEntity.findUnique({
      where: { id: objectId },
      select: { id: true, ownerId: true },
    });

    if (!object) {
      throw new NotFoundException("Object not found");
    }

    await this.ensureUserObjectRole(actorId, objectId, [UserRole.DIRECTOR]);

    if (actorId === userId) {
      throw new BadRequestException("You cannot remove yourself from object");
    }

    if (object.ownerId === userId) {
      throw new BadRequestException("Object owner cannot be removed");
    }

    const access = await this.prisma.userObjectAccess.findUnique({
      where: {
        userId_objectId: {
          userId,
          objectId,
        },
      },
    });

    if (!access) {
      throw new NotFoundException("Object access not found");
    }

    await this.prisma.userObjectAccess.delete({
      where: {
        userId_objectId: {
          userId,
          objectId,
        },
      },
    });

    return { deleted: true };
  }

  async inviteUser(objectId: string, dto: InviteUserDto, inviterId: string) {
    const inviteEmail = dto.email.trim().toLowerCase();
    const object = await this.prisma.objectEntity.findUnique({
      where: { id: objectId },
      select: { id: true, name: true, ownerId: true },
    });

    if (!object) {
      throw new NotFoundException("Object not found");
    }

    await this.ensureUserObjectRole(inviterId, objectId, [UserRole.DIRECTOR]);

    const inviter = await this.prisma.user.findUnique({
      where: { id: inviterId },
      select: { id: true, email: true, name: true },
    });

    if (!inviter) {
      throw new NotFoundException("Inviter not found");
    }

    if (inviter.email.trim().toLowerCase() === inviteEmail) {
      throw new BadRequestException("You cannot invite yourself");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: inviteEmail },
      select: { id: true, email: true, name: true },
    });

    if (existingUser) {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUniqueOrThrow({
          where: { id: existingUser.id },
          select: { id: true, email: true, name: true },
        });

        const access = await tx.userObjectAccess.upsert({
          where: {
            userId_objectId: {
              userId: existingUser.id,
              objectId,
            },
          },
          create: {
            userId: existingUser.id,
            objectId,
            role: dto.userRole,
          },
          update: {
            role: dto.userRole,
          },
        });

        return { user, access };
      });

      const mail = await this.mail.sendAccessGrantedEmail({
        to: result.user.email,
        name: result.user.name,
        objectName: object.name,
        invitedBy: inviter.name,
      });

      return {
        type: "existing_user_access_granted",
        user: result.user,
        access: result.access,
        mail,
      };
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = this.hashInvitationToken(token);
    const expiresInHours = Number(
      this.config.get<string>("INVITATION_EXPIRES_HOURS") ?? 72,
    );
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        email: inviteEmail,
        name: dto.name,
        tokenHash,
        userRole: dto.userRole,
        objectId,
        inviterId,
        expiresAt,
      },
      select: {
        id: true,
        email: true,
        name: true,
        userRole: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    const inviteLink = this.createInviteLink(token);
    const mail = await this.mail.sendInvitationEmail({
      to: inviteEmail,
      name: dto.name,
      objectName: object.name,
      invitedBy: inviter.name,
      inviteLink,
    });

    return {
      invitation,
      mail,
      inviteLink,
    };
  }

  async createMaterial(
    objectId: string,
    dto: CreateObjectMaterialDto,
    actorId: string,
  ) {
    await this.ensureObjectExists(objectId);
    await this.ensureUserObjectRole(actorId, objectId, [
      UserRole.DIRECTOR,
      UserRole.CHIEF_ENGINEER,
    ]);

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
    actorId: string,
  ) {
    await this.ensureUserObjectRole(actorId, objectId, [UserRole.DIRECTOR]);

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
      },
    });
  }

  async deleteMaterial(objectId: string, materialId: string, actorId: string) {
    await this.ensureUserObjectRole(actorId, objectId, [UserRole.DIRECTOR]);

    const material = await this.prisma.objectMaterial.findFirst({
      where: { id: materialId, objectId },
      select: { id: true },
    });

    if (!material) {
      throw new NotFoundException("Object material not found");
    }

    await this.prisma.objectMaterial.delete({
      where: { id: materialId },
    });

    return { deleted: true };
  }

  async delete(id: string, actorId: string) {
    const object = await this.prisma.objectEntity.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        _count: {
          select: {
            supplyRequests: true,
          },
        },
      },
    });

    if (!object) {
      throw new NotFoundException("Object not found");
    }

    if (object.ownerId !== actorId) {
      throw new BadRequestException("Only object owner can delete object");
    }

    if (object._count.supplyRequests > 0) {
      throw new BadRequestException(
        "Object with supply requests cannot be deleted",
      );
    }

    await this.prisma.objectEntity.delete({
      where: { id },
    });

    return { success: true };
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

  private async ensureUserObjectRole(
    userId: string,
    objectId: string,
    roles: UserRole[],
  ) {
    const access = await this.prisma.userObjectAccess.findUnique({
      where: {
        userId_objectId: {
          userId,
          objectId,
        },
      },
    });

    if (!access || !roles.includes(access.role)) {
      throw new BadRequestException("User role is not allowed for this object");
    }
  }

  private createInviteLink(token: string) {
    const clientUrl =
      this.config.get<string>("CLIENT_URL") ?? "http://localhost:3001";

    return `${clientUrl}/accept-invitation?token=${token}`;
  }

  private hashInvitationToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

}

