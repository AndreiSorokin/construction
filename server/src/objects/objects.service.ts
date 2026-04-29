import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ObjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.objectEntity.findMany({
      include: {
        owner: true,
        materials: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
