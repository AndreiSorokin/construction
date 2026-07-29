import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import configuration from './config/configuration';
import { HealthController } from './controllers/health.controller';
import { PrismaModule } from './modules/prisma.module';
import { AuthModule } from './modules/auth.module';
import { UsersModule } from './modules/users.module';
import { RequestsModule } from './modules/requests.module';
import { OrdersModule } from './modules/orders.module';
import { FilesModule } from './modules/files.module';
import { MailModule } from './modules/mail.module';
import { NotesModule } from './modules/notes.module';
import { DepartmentsModule } from './modules/departments.module';
import { ObjectsModule } from './modules/objects.module';
import { CatalogModule } from './modules/catalog.module';
import { WorkCatalogsModule } from './modules/work-catalogs.module';
import { IpsModule } from './modules/ips.module';
import { ChainsModule } from './modules/chains.module';
import { MetaModule } from './modules/meta.module';
import { CommsModule } from './modules/comms.module';
import { SettingsModule } from './modules/settings.module';
import { DeltaModule } from './modules/delta.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // общий лимит на все ручки; на /auth/login — отдельный, строже (см. auth.controller.ts)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    RequestsModule,
    OrdersModule,
    FilesModule,
    MailModule,
    NotesModule,
    DepartmentsModule,
    ObjectsModule,
    CatalogModule,
    WorkCatalogsModule,
    IpsModule,
    ChainsModule,
    MetaModule,
    CommsModule,
    SettingsModule,
    DeltaModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
