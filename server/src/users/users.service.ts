import { Injectable } from "@nestjs/common";
import { hash } from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const passwordHash = await hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
      },
      select: this.safeUserSelect,
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      select: this.safeUserSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  private readonly safeUserSelect = {
    id: true,
    email: true,
    name: true,
    createdAt: true,
    updatedAt: true,
  };
}
