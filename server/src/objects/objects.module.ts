import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { StorageModule } from "../storage/storage.module";
import { ObjectsController } from "./objects.controller";
import { ObjectsService } from "./objects.service";

@Module({
  imports: [MailModule, StorageModule],
  controllers: [ObjectsController],
  providers: [ObjectsService],
  exports: [ObjectsService],
})
export class ObjectsModule {}
