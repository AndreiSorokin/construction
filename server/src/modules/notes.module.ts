import { Module } from '@nestjs/common';
import { NotesService } from '../services/notes.service';
import { NotesController } from '../controllers/notes.controller';

@Module({ providers: [NotesService], controllers: [NotesController] })
export class NotesModule {}
