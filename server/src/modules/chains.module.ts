import { Module } from '@nestjs/common';
import { ChainsService } from '../services/chains.service';
import { ChainsController } from '../controllers/chains.controller';

@Module({ providers: [ChainsService], controllers: [ChainsController] })
export class ChainsModule {}
