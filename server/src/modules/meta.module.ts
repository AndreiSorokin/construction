import { Module } from '@nestjs/common';
import { MetaService } from '../services/meta.service';
import { MetaController } from '../controllers/meta.controller';

@Module({ providers: [MetaService], controllers: [MetaController] })
export class MetaModule {}
