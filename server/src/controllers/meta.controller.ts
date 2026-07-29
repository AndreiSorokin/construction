import { Controller, Get } from '@nestjs/common';
import { MetaService } from '../services/meta.service';
import { CurrentUser } from '../decorators/current-user.decorator';

@Controller('meta')
export class MetaController {
  constructor(private meta: MetaService) {}

  /** все справочные данные + профиль одним запросом */
  @Get('bootstrap')
  bootstrap(@CurrentUser('id') userId: string) {
    return this.meta.bootstrap(userId);
  }
}
