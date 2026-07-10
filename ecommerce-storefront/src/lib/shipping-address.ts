export type NormalizedAddress = {
  name?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
};

export function normalizeShippingAddress(input: unknown): NormalizedAddress | null {
  if (typeof input !== 'object' || input === null) return null;
  const a = input as Record<string, unknown>;
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined;
  const line1 = str(a.line1);
  const city = str(a.city);
  const postalCode = str(a.postalCode) ?? str(a.postal_code);
  const country = str(a.country);
  if (!line1 || !city || !postalCode || !country) return null;
  return {
    name: str(a.name),
    line1,
    line2: str(a.line2),
    city,
    state: str(a.state),
    postalCode,
    country,
  };
}
