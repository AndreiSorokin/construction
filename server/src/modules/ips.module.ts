import { Module } from '@nestjs/common';
import { IpsService } from '../services/ips.service';
import { IpsController } from '../controllers/ips.controller';

@Module({ providers: [IpsService], controllers: [IpsController] })
export class IpsModule {}
