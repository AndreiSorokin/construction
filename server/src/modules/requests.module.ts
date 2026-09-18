import { Module } from '@nestjs/common';
import { RequestsService } from '../services/requests.service';
import { RequestsAutoConfirmService } from '../services/requests-auto-confirm.service';
import { RequestsController } from '../controllers/requests.controller';

@Module({ providers: [RequestsService, RequestsAutoConfirmService], controllers: [RequestsController] })
export class RequestsModule {}
