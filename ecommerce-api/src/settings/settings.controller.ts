import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import {
  ShippingSettingsDto,
  UpdateShippingSettingsDto,
} from './dto/shipping-settings.dto';
import { SettingsService } from './settings.service';
import { StoreSettings } from '@prisma/client';

const toDto = (row: StoreSettings): ShippingSettingsDto => ({
  freeShippingThresholdCents: row.freeShippingThresholdCents,
  standardShippingCents: row.standardShippingCents,
  expeditedShippingCents: row.expeditedShippingCents,
});

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('shipping')
  @ApiOkResponse({ type: ShippingSettingsDto })
  async getShipping(): Promise<ShippingSettingsDto> {
    return toDto(await this.settings.getShippingSettings());
  }

  @Put('shipping')
  @ApiOkResponse({ type: ShippingSettingsDto })
  async updateShipping(
    @Body() dto: UpdateShippingSettingsDto,
  ): Promise<ShippingSettingsDto> {
    return toDto(await this.settings.updateShippingSettings(dto));
  }
}
