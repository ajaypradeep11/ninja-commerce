import { SettingsService } from './settings.service';

const ROW = {
  id: 1,
  freeShippingThresholdCents: 6500,
  standardShippingCents: 999,
  expeditedShippingCents: 1499,
  updatedAt: new Date('2026-07-24T00:00:00Z'),
};

describe('SettingsService', () => {
  let prisma: { storeSettings: { upsert: jest.Mock } };
  let service: SettingsService;

  beforeEach(() => {
    prisma = { storeSettings: { upsert: jest.fn().mockResolvedValue(ROW) } };
    service = new SettingsService(prisma as never);
  });

  it('reads via upsert so a missing row is created with defaults', async () => {
    const result = await service.getShippingSettings();
    expect(prisma.storeSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
    expect(result).toEqual(ROW);
  });

  it('updates all three fields via upsert', async () => {
    const dto = {
      freeShippingThresholdCents: 7000,
      standardShippingCents: 1099,
      expeditedShippingCents: 1599,
    };
    await service.updateShippingSettings(dto);
    expect(prisma.storeSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: dto,
      create: { id: 1, ...dto },
    });
  });
});
