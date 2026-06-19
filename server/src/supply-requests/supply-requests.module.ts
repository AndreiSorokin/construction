import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { SupplyRequestsController } from "./supply-requests.controller";
import { SupplyRequestsService } from "./supply-requests.service";

@Module({
  imports: [StorageModule],
  controllers: [SupplyRequestsController],
  providers: [SupplyRequestsService],
  exports: [SupplyRequestsService],
})
export class SupplyRequestsModule {}
