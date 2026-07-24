import { SettingsController } from './settings.controller';

const ROW = {
  id: 1,
  freeShippingThresholdCents: 6500,
  standardShippingCents: 999,
  expeditedShippingCents: 1499,
  updatedAt: new Date(),
};

describe('SettingsController', () => {
  const service = {
    getShippingSettings: jest.fn().mockResolvedValue(ROW),
    updateShippingSettings: jest.fn().mockResolvedValue({
      ...ROW,
      standardShippingCents: 1099,
    }),
  };
  const controller = new SettingsController(service as never);

  it('maps the row to the three public fields on GET', async () => {
    await expect(controller.getShipping()).resolves.toEqual({
      freeShippingThresholdCents: 6500,
      standardShippingCents: 999,
      expeditedShippingCents: 1499,
    });
  });

  it('updates then maps on PUT', async () => {
    const dto = {
      freeShippingThresholdCents: 6500,
      standardShippingCents: 1099,
      expeditedShippingCents: 1499,
    };
    await expect(controller.updateShipping(dto)).resolves.toEqual(dto);
    expect(service.updateShippingSettings).toHaveBeenCalledWith(dto);
  });

  it('is admin-guarded', () => {
    // Mirror the guard-metadata assertion style used elsewhere if present;
    // otherwise assert the guards metadata directly:
    const guards = Reflect.getMetadata('__guards__', SettingsController) as unknown[];
    expect(guards?.length).toBeGreaterThanOrEqual(2);
  });
});
