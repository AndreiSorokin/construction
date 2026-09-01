import { Module } from '@nestjs/common';
import { OrganizationsController } from '../controllers/organizations.controller';
import { OrganizationsService } from '../services/organizations.service';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule], // переиспользуем TokenService
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
