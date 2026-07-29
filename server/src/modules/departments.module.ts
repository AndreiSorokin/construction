import { Module } from '@nestjs/common';
import { DepartmentsService } from '../services/departments.service';
import { DepartmentsController } from '../controllers/departments.controller';

@Module({ providers: [DepartmentsService], controllers: [DepartmentsController] })
export class DepartmentsModule {}
