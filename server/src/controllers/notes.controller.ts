import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { NotesService } from '../services/notes.service';
import { UpdateNoteDto } from '../dto/note.dto';
import { CurrentUser } from '../decorators/current-user.decorator';

@Controller('notes')
export class NotesController {
  constructor(private notes: NotesService) {}

  @Get() list(@CurrentUser('id') userId: string) { return this.notes.list(userId); }

  @Post() create(@CurrentUser('id') userId: string) { return this.notes.create(userId); }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() dto: UpdateNoteDto) {
    return this.notes.update(id, userId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notes.remove(id, userId);
  }
}
