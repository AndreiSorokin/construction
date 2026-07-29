import { Module } from '@nestjs/common';
import { WorkCatalogsService } from '../services/work-catalogs.service';
import { WorkCatalogsController } from '../controllers/work-catalogs.controller';

@Module({ providers: [WorkCatalogsService], controllers: [WorkCatalogsController] })
export class WorkCatalogsModule {}
