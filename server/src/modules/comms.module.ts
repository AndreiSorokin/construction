import { Module } from '@nestjs/common';
import { CommsController } from '../controllers/comms.controller';
import { CommsService } from '../services/comms.service';

@Module({ controllers: [CommsController], providers: [CommsService] })
export class CommsModule {}
