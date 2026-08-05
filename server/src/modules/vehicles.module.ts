import { Module } from '@nestjs/common';
import { VehiclesService } from '../services/vehicles.service';
import { VehiclesController } from '../controllers/vehicles.controller';

@Module({ providers: [VehiclesService], controllers: [VehiclesController] })
export class VehiclesModule {}
