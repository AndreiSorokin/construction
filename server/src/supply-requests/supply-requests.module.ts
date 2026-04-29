import { Module } from "@nestjs/common";
import { SupplyRequestsService } from "./supply-requests.service";

@Module({
  providers: [SupplyRequestsService],
  exports: [SupplyRequestsService],
})
export class SupplyRequestsModule {}
