import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCheckoutDto } from './create-checkout.dto';

const base = { items: [{ productId: 'p1', quantity: 1 }] };

async function errorsFor(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateCheckoutDto, payload);
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}).map(() => e.property));
}

describe('CreateCheckoutDto currency', () => {
  it('accepts CAD', async () => {
    expect(await errorsFor({ ...base, currency: 'CAD' })).not.toContain('currency');
  });

  it('accepts USD', async () => {
    expect(await errorsFor({ ...base, currency: 'USD' })).not.toContain('currency');
  });

  it('rejects an unsupported currency', async () => {
    expect(await errorsFor({ ...base, currency: 'EUR' })).toContain('currency');
  });

  it('rejects a missing currency', async () => {
    expect(await errorsFor(base)).toContain('currency');
  });
});
