import { Module } from '@nestjs/common';
import { ObjectsService } from '../services/objects.service';
import { ObjectsController } from '../controllers/objects.controller';

@Module({ providers: [ObjectsService], controllers: [ObjectsController] })
export class ObjectsModule {}
