import { Module } from "@nestjs/common";
import { SupplyRequestsController } from "./supply-requests.controller";
import { SupplyRequestsService } from "./supply-requests.service";

@Module({
  controllers: [SupplyRequestsController],
  providers: [SupplyRequestsService],
  exports: [SupplyRequestsService],
})
export class SupplyRequestsModule {}
