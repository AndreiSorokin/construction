import { Controller, Get } from '@nestjs/common';
import { MetaService } from '../services/meta.service';
import { CurrentUser, AuthUser } from '../decorators/current-user.decorator';

@Controller('meta')
export class MetaController {
  constructor(private meta: MetaService) {}

  /** все справочные данные + профиль одним запросом */
  @Get('bootstrap')
  bootstrap(@CurrentUser() u: AuthUser) {
    return this.meta.bootstrap(u.orgId, u.id);
  }
}
