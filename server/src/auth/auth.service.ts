import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { AuthenticatedUser } from "./types/authenticated-user";
import { JwtPayload } from "./types/jwt-payload";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    const passwordHash = await hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    return this.createAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isPasswordValid = await compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.createAuthResponse({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  }

  async acceptInvitation(dto: AcceptInvitationDto) {
    const tokenHash = this.hashInvitationToken(dto.token);
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation || invitation.acceptedAt) {
      throw new UnauthorizedException("Invalid invitation");
    }

    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Invitation expired");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    const passwordHash = await hash(dto.password, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          name: invitation.name,
          objectAccesses: {
            create: {
              objectId: invitation.objectId,
              role: invitation.userRole,
            },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return createdUser;
    });

    return this.createAuthResponse(user);
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const isRefreshTokenValid = await compare(
      dto.refreshToken,
      user.refreshTokenHash,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return this.createAuthResponse({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });

    return { success: true };
  }

  private async createAuthResponse(user: AuthenticatedUser) {
    const tokens = await this.signTokens(user);
    const refreshTokenHash = await hash(tokens.refreshToken, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return {
      ...tokens,
      user,
    };
  }

  private async signTokens(user: AuthenticatedUser) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    return {
      accessToken: await this.jwt.signAsync(payload, {
        secret: this.getAccessTokenSecret(),
        expiresIn: (this.config.get<string>("JWT_EXPIRES_IN") ??
          "15m") as never,
      }),
      refreshToken: await this.jwt.signAsync(payload, {
        secret: this.getRefreshTokenSecret(),
        expiresIn: (this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ??
          "30d") as never,
      }),
    };
  }

  private async verifyRefreshToken(refreshToken: string): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.getRefreshTokenSecret(),
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  private getAccessTokenSecret() {
    return this.config.get<string>("JWT_SECRET") ?? "dev-secret-change-me";
  }

  private getRefreshTokenSecret() {
    return (
      this.config.get<string>("JWT_REFRESH_SECRET") ??
      `${this.getAccessTokenSecret()}-refresh`
    );
  }

  private hashInvitationToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
