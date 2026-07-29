import { Module } from '@nestjs/common';
import { FilesService } from '../services/files.service';
import { FilesController } from '../controllers/files.controller';

@Module({ controllers: [FilesController], providers: [FilesService], exports: [FilesService] })
export class FilesModule {}
