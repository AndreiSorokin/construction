import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SupplyRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.supplyRequest.findMany({
      include: {
        author: true,
        object: true,
        items: true,
        approvalHistory: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
