import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { CreateUserDto, UpdateUserDto, ResetPasswordDto } from '../dto/user.dto';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser, AuthUser } from '../decorators/current-user.decorator';

@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get() list() { return this.users.list(); }

  @Post() create(@Body() dto: CreateUserDto) { return this.users.create(dto); }

  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() u: AuthUser) {
    return this.users.update(id, dto, u);
  }

  @Post(':id/password') reset(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.users.resetPassword(id, dto.newPassword);
  }

  /** увольнение: деактивация + вычистка из маршрутов и доступа к объектам; зависшие этапы перескакивают */
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.users.deactivate(id, u);
  }
}
