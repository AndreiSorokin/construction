import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { MailModule } from "./mail/mail.module";
import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./users/users.module";
import { ObjectsModule } from "./objects/objects.module";
import { SupplyRequestsModule } from "./supply-requests/supply-requests.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../.env"],
    }),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    ObjectsModule,
    SupplyRequestsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
