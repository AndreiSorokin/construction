import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import { Prisma, UserObjectRole, UserRole } from "@prisma/client";
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
      select: { id: true, role: true },
    });

    if (!owner) {
      throw new NotFoundException("User not found");
    }

    if (owner.role && owner.role !== UserRole.DIRECTOR) {
      throw new BadRequestException(
        "Only users without role or directors can create objects",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (!owner.role) {
        await tx.user.update({
          where: { id: ownerId },
          data: { role: UserRole.DIRECTOR },
        });
      }

      const object = await tx.objectEntity.create({
        data: {
          name: dto.name,
          type: dto.type,
          closingLimit: new Prisma.Decimal(dto.closingLimit),
          ownerId,
        },
      });

      await tx.userObjectAccess.create({
        data: {
          objectId: object.id,
          userId: ownerId,
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

  async inviteUser(objectId: string, dto: InviteUserDto, inviterId: string) {
    const object = await this.prisma.objectEntity.findUnique({
      where: { id: objectId },
      select: { id: true, name: true, ownerId: true },
    });

    if (!object) {
      throw new NotFoundException("Object not found");
    }

    if (object.ownerId !== inviterId) {
      throw new BadRequestException("Only object owner can invite users");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, name: true },
    });

    const inviter = await this.prisma.user.findUnique({
      where: { id: inviterId },
      select: { name: true },
    });

    if (!inviter) {
      throw new NotFoundException("Inviter not found");
    }

    if (existingUser) {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: existingUser.id },
          data: { role: dto.userRole },
          select: { id: true, email: true, name: true, role: true },
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
            role: dto.objectRole ?? UserObjectRole.VIEWER,
          },
          update: {
            role: dto.objectRole ?? UserObjectRole.VIEWER,
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
        email: dto.email,
        name: dto.name,
        tokenHash,
        userRole: dto.userRole,
        objectRole: dto.objectRole ?? UserObjectRole.VIEWER,
        objectId,
        inviterId,
        expiresAt,
      },
      select: {
        id: true,
        email: true,
        name: true,
        userRole: true,
        objectRole: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    const inviteLink = this.createInviteLink(token);
    const mail = await this.mail.sendInvitationEmail({
      to: dto.email,
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

  private createInviteLink(token: string) {
    const clientUrl =
      this.config.get<string>("CLIENT_URL") ?? "http://localhost:3001";

    return `${clientUrl}/accept-invitation?token=${token}`;
  }

  private hashInvitationToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
