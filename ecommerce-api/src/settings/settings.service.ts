import { Injectable } from '@nestjs/common';
import { StoreSettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateShippingSettingsDto } from './dto/shipping-settings.dto';

// Singleton row (id=1). Reads upsert so a fresh database never 500s — the
// schema defaults ARE the store defaults.
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  getShippingSettings(): Promise<StoreSettings> {
    return this.prisma.storeSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
  }

  updateShippingSettings(dto: UpdateShippingSettingsDto): Promise<StoreSettings> {
    return this.prisma.storeSettings.upsert({
      where: { id: 1 },
      update: dto,
      create: { id: 1, ...dto },
    });
  }
}
