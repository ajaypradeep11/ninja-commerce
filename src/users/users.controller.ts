import { Body, Controller, Get, Put } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { UpdateAddressesDto } from './dto/update-addresses.dto';
import { UsersService } from './users.service';

@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  getMe(@CurrentUser() user: AuthUser): Promise<User> {
    return this.users.getMe(user.uid, user.email);
  }

  @Put('addresses')
  updateAddresses(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateAddressesDto,
  ): Promise<User> {
    return this.users.updateAddresses(user.uid, user.email, dto.addresses);
  }
}
