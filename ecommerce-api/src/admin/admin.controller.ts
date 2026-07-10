import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { AdminService } from './admin.service';
import { AdminStatsDto } from './dto/admin-stats.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: AdminStatsDto })
  @Get('stats')
  stats(): Promise<AdminStatsDto> {
    return this.admin.stats();
  }
}
