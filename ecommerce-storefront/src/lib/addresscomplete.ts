// Canada Post AddressComplete JSON client. Both functions degrade silently:
// no key, network failure, or an error payload → empty result, so the address
// form always falls back to plain typing.
const BASE =
  'https://ws1.postescanada-canadapost.ca/AddressComplete/Interactive';

export type AddressSuggestion = {
  id: string;
  text: string;
  description: string;
  next: 'Find' | 'Retrieve';
};

export type RetrievedAddress = {
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
};

function apiKey(): string | null {
  // Statically referenced so Next.js inlines it client-side.
  const key = process.env.NEXT_PUBLIC_ADDRESSCOMPLETE_KEY;
  return key ? key : null;
}

async function getItems(url: string): Promise<Record<string, unknown>[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data: unknown = await res.json();
    const items =
      typeof data === 'object' && data !== null && 'Items' in data
        ? (data as { Items: unknown }).Items
        : null;
    if (!Array.isArray(items)) return [];
    const rows = items as Record<string, unknown>[];
    if (rows.some((row) => row.Error !== undefined)) return [];
    return rows;
  } catch {
    return [];
  }
}

export async function findAddresses(
  searchTerm: string,
  lastId?: string,
): Promise<AddressSuggestion[]> {
  const key = apiKey();
  if (!key) return [];
  const params = new URLSearchParams({
    Key: key,
    SearchTerm: searchTerm,
    Country: 'CAN',
    LanguagePreference: 'en',
  });
  if (lastId) params.set('LastId', lastId);
  const rows = await getItems(`${BASE}/Find/v2.10/json3.ws?${params}`);
  return rows
    .filter((row) => typeof row.Id === 'string' && typeof row.Text === 'string')
    .map((row) => ({
      id: row.Id as string,
      text: row.Text as string,
      description: typeof row.Description === 'string' ? row.Description : '',
      next: row.Next === 'Find' ? ('Find' as const) : ('Retrieve' as const),
    }));
}

export async function retrieveAddress(
  id: string,
): Promise<RetrievedAddress | null> {
  const key = apiKey();
  if (!key) return null;
  const params = new URLSearchParams({ Key: key, Id: id });
  const rows = await getItems(`${BASE}/Retrieve/v2.11/json3.ws?${params}`);
  const row = rows.find((r) => r.Language === 'ENG') ?? rows[0];
  if (!row || typeof row.Line1 !== 'string' || typeof row.City !== 'string') {
    return null;
  }
  const str = (v: unknown) => (typeof v === 'string' && v ? v : '');
  return {
    line1: row.Line1,
    line2: str(row.Line2) || undefined,
    city: row.City,
    province: str(row.ProvinceCode),
    postalCode: str(row.PostalCode),
  };
}
