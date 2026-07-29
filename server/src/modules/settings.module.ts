import { Module } from '@nestjs/common';
import { SettingsController } from '../controllers/settings.controller';
import { SettingsService } from '../services/settings.service';
import { FilesModule } from './files.module';

@Module({ imports: [FilesModule], controllers: [SettingsController], providers: [SettingsService] })
export class SettingsModule {}
