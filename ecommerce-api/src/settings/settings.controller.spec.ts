import { AdminGuard } from '../auth/admin.guard';
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
    // FirebaseAuthGuard is registered globally (APP_GUARD), so only
    // AdminGuard needs to be declared here — mirror other admin controllers.
    const guards = Reflect.getMetadata('__guards__', SettingsController) as unknown[];
    expect(guards).toContain(AdminGuard);
  });
});
