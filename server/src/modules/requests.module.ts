import { Module } from '@nestjs/common';
import { RequestsService } from '../services/requests.service';
import { RequestsController } from '../controllers/requests.controller';

@Module({ providers: [RequestsService], controllers: [RequestsController] })
export class RequestsModule {}
