# Canada-only Shipping + Canada Post Address Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict shipping to Canada everywhere and add Canada Post AddressComplete autocomplete to the saved-address form.

**Architecture:** The API's Stripe session narrows `allowed_countries` to `['CA']`; storefront copy drops US shipping. The saved-address form locks country to CA, validates Canadian postal codes, and gains a Line-1 autocomplete backed by a new typed client for the AddressComplete JSON API (`Find` v2.10 + `Retrieve` v2.11), called client-side and degrading silently when `NEXT_PUBLIC_ADDRESSCOMPLETE_KEY` is unset.

**Tech Stack:** NestJS + Jest (API); Next.js 15, react-hook-form + zod, Vitest + Testing Library (storefront).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-23-canada-only-addresscomplete-design.md`.
- Dual currency (CAD/USD) stays — do not touch `CurrencySwitcher` or price rendering.
- `'US'` literals in `webhooks.service.spec.ts` / `app.e2e-spec.ts` are billing fixtures — leave them.
- AddressComplete endpoints: `https://ws1.postescanada-canadapost.ca/AddressComplete/Interactive/Find/v2.10/json3.ws` and `.../Retrieve/v2.11/json3.ws` (verified against Canada Post docs 2026-07-23).
- No key → every lookup returns empty/null; the form must always work as plain typing.
- Storefront lint is `oxlint`; API lint is eslint (auto-fixes — don't run mid-edit).

---

### Task 1: API — Stripe checkout ships to Canada only

**Files:**
- Modify: `ecommerce-api/src/checkout/checkout.service.ts:18-20`
- Test: `ecommerce-api/src/checkout/checkout.service.spec.ts:156-159,278-281`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: Stripe sessions with `shipping_address_collection.allowed_countries === ['CA']`.

- [ ] **Step 1: Update the two spec assertions to expect CA only**

In `ecommerce-api/src/checkout/checkout.service.spec.ts` there are exactly two assertions on `allowed_countries` (~line 156 and ~line 279). Change both from:

```ts
    expect(sessionArgs.shipping_address_collection.allowed_countries).toEqual([
      'CA',
      'US',
    ]);
```

to:

```ts
    expect(sessionArgs.shipping_address_collection.allowed_countries).toEqual([
      'CA',
    ]);
```

(The second site uses the variable name `session` instead of `sessionArgs` — keep the variable name, change only the expected array.) Also update the comment above the first assertion from `// Canada and the US; Stripe Tax computes the destination's sales tax.` to `// Canada only; Stripe Tax computes the destination's sales tax.`

- [ ] **Step 2: Run the spec to verify it fails**

Run: `cd ecommerce-api && npx jest src/checkout/checkout.service.spec.ts`
Expected: FAIL — the two updated assertions receive `['CA', 'US']`.

- [ ] **Step 3: Narrow SHIPPING_COUNTRIES**

In `ecommerce-api/src/checkout/checkout.service.ts` replace lines 18-20:

```ts
// Canada and the US. Stripe Tax computes the destination's sales tax from the
// address the customer enters on the hosted Checkout page.
const SHIPPING_COUNTRIES = ['CA', 'US'] as const;
```

with:

```ts
// Canada only. Stripe Tax computes the destination's sales tax from the
// address the customer enters on the hosted Checkout page.
const SHIPPING_COUNTRIES = ['CA'] as const;
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `cd ecommerce-api && npx jest src/checkout/checkout.service.spec.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add ecommerce-api/src/checkout/checkout.service.ts ecommerce-api/src/checkout/checkout.service.spec.ts
git commit -m "API: Stripe checkout ships to Canada only"
```

---

### Task 2: Storefront — drop US shipping copy

**Files:**
- Modify: `ecommerce-storefront/src/app/(store)/shipping/page.tsx:54-66`
- Modify: `ecommerce-storefront/src/app/(store)/faq/page.tsx:28`
- Modify: `ecommerce-storefront/src/lib/site.ts:15`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: no US-shipping copy anywhere; `policy.freeShippingUsd` no longer exists.

- [ ] **Step 1: Remove the US section from the shipping page**

In `ecommerce-storefront/src/app/(store)/shipping/page.tsx` delete the whole section (lines 54-66):

```tsx
      <section>
        <h2 className="font-display text-xl text-ink">Shipping to the United States</h2>
        <p className="mt-2">
          We ship across the US with free standard delivery on orders over{' '}
          {policy.freeShippingUsd}. Standard delivery takes 5 to 9 business
          days, and expedited rates are calculated at checkout based on your
          location.
        </p>
        <p className="mt-4">
          US orders are priced and charged in US dollars — switch the currency
          at the bottom of any page to see US pricing.
        </p>
      </section>
```

- [ ] **Step 2: Update the FAQ free-shipping answer**

In `ecommerce-storefront/src/app/(store)/faq/page.tsx` line 28, change:

```ts
        answer: `Yes. We offer free standard shipping on all Canadian orders over ${policy.freeShipping}, and free standard shipping on all US orders over ${policy.freeShippingUsd}.`,
```

to:

```ts
        answer: `Yes. We offer free standard shipping on all Canadian orders over ${policy.freeShipping}.`,
```

- [ ] **Step 3: Remove the now-unused freeShippingUsd from site.ts**

In `ecommerce-storefront/src/lib/site.ts` delete line 15:

```ts
    freeShippingUsd: '$49 USD',
```

Then confirm nothing else references it: `cd ecommerce-storefront && grep -rn "freeShippingUsd" src` — expected: no matches.

- [ ] **Step 4: Lint, typecheck-via-tests**

Run: `cd ecommerce-storefront && npm run lint && npm test`
Expected: lint clean; all existing vitest tests PASS (no test covers the deleted copy).

- [ ] **Step 5: Commit**

```bash
git add "ecommerce-storefront/src/app/(store)/shipping/page.tsx" "ecommerce-storefront/src/app/(store)/faq/page.tsx" ecommerce-storefront/src/lib/site.ts
git commit -m "Storefront: shipping copy covers Canada only"
```

---

### Task 3: AddressComplete client (`src/lib/addresscomplete.ts`)

**Files:**
- Create: `ecommerce-storefront/src/lib/addresscomplete.ts`
- Test: `ecommerce-storefront/src/lib/addresscomplete.test.ts`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_ADDRESSCOMPLETE_KEY` env var; global `fetch`.
- Produces (used verbatim by Task 5):

```ts
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
  province: string;   // two-letter code, e.g. "ON"
  postalCode: string; // "K1A 0B1"
};
export declare function findAddresses(searchTerm: string, lastId?: string): Promise<AddressSuggestion[]>;
export declare function retrieveAddress(id: string): Promise<RetrievedAddress | null>;
```

- [ ] **Step 1: Write the failing tests**

Create `ecommerce-storefront/src/lib/addresscomplete.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findAddresses, retrieveAddress } from './addresscomplete';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_ADDRESSCOMPLETE_KEY', 'TEST-KEY');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) } as Response;
}

describe('findAddresses', () => {
  it('queries Find with key, term, and Country=CAN and maps items', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        Items: [
          {
            Id: 'CA|1',
            Text: '1 Main St',
            Description: 'Ottawa, ON, K1A 0B1',
            Next: 'Retrieve',
          },
          {
            Id: 'CA|2',
            Text: '10 Apt Blvd',
            Description: '24 addresses',
            Next: 'Find',
          },
        ],
      }),
    );

    const result = await findAddresses('1 Main');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe(
      '/AddressComplete/Interactive/Find/v2.10/json3.ws',
    );
    expect(url.searchParams.get('Key')).toBe('TEST-KEY');
    expect(url.searchParams.get('SearchTerm')).toBe('1 Main');
    expect(url.searchParams.get('Country')).toBe('CAN');
    expect(url.searchParams.get('LastId')).toBeNull();
    expect(result).toEqual([
      {
        id: 'CA|1',
        text: '1 Main St',
        description: 'Ottawa, ON, K1A 0B1',
        next: 'Retrieve',
      },
      {
        id: 'CA|2',
        text: '10 Apt Blvd',
        description: '24 addresses',
        next: 'Find',
      },
    ]);
  });

  it('passes LastId when drilling into a container', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ Items: [] }));

    await findAddresses('Apt', 'CA|2');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('LastId')).toBe('CA|2');
  });

  it('returns [] when the key is unset without fetching', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADDRESSCOMPLETE_KEY', '');

    expect(await findAddresses('1 Main')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns [] on an AddressComplete error payload', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        Items: [{ Error: '2', Description: 'Unknown key' }],
      }),
    );

    expect(await findAddresses('1 Main')).toEqual([]);
  });

  it('returns [] when fetch rejects or the response is not ok', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    expect(await findAddresses('1 Main')).toEqual([]);

    fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
    expect(await findAddresses('1 Main')).toEqual([]);
  });
});

describe('retrieveAddress', () => {
  it('queries Retrieve and maps the ENG row', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        Items: [
          {
            Language: 'FRE',
            Line1: '1 rue Principale',
            City: 'Ottawa',
            ProvinceCode: 'ON',
            PostalCode: 'K1A 0B1',
          },
          {
            Language: 'ENG',
            Line1: '1 Main St',
            Line2: 'Unit 4',
            City: 'Ottawa',
            ProvinceCode: 'ON',
            PostalCode: 'K1A 0B1',
          },
        ],
      }),
    );

    const result = await retrieveAddress('CA|1');

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe(
      '/AddressComplete/Interactive/Retrieve/v2.11/json3.ws',
    );
    expect(url.searchParams.get('Key')).toBe('TEST-KEY');
    expect(url.searchParams.get('Id')).toBe('CA|1');
    expect(result).toEqual({
      line1: '1 Main St',
      line2: 'Unit 4',
      city: 'Ottawa',
      province: 'ON',
      postalCode: 'K1A 0B1',
    });
  });

  it('omits line2 when blank and falls back to any non-error row', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        Items: [
          {
            Language: 'FRE',
            Line1: '1 rue Principale',
            Line2: '',
            City: 'Gatineau',
            ProvinceCode: 'QC',
            PostalCode: 'J8X 2Y9',
          },
        ],
      }),
    );

    expect(await retrieveAddress('CA|9')).toEqual({
      line1: '1 rue Principale',
      line2: undefined,
      city: 'Gatineau',
      province: 'QC',
      postalCode: 'J8X 2Y9',
    });
  });

  it('returns null when the key is unset, on errors, or on empty payloads', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADDRESSCOMPLETE_KEY', '');
    expect(await retrieveAddress('CA|1')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv('NEXT_PUBLIC_ADDRESSCOMPLETE_KEY', 'TEST-KEY');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ Items: [{ Error: '2', Description: 'Unknown key' }] }),
    );
    expect(await retrieveAddress('CA|1')).toBeNull();

    fetchMock.mockRejectedValueOnce(new Error('network down'));
    expect(await retrieveAddress('CA|1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ecommerce-storefront && npx vitest run src/lib/addresscomplete.test.ts`
Expected: FAIL — `./addresscomplete` module not found.

- [ ] **Step 3: Implement the client**

Create `ecommerce-storefront/src/lib/addresscomplete.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ecommerce-storefront && npx vitest run src/lib/addresscomplete.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Document the env var**

In `ecommerce-storefront/.env.example`, after the `NEXT_PUBLIC_SUCCESS_TIMEOUT_MS=` line, add:

```
# Canada Post AddressComplete key for address autocomplete (optional — the
# address form degrades to plain typing without it)
NEXT_PUBLIC_ADDRESSCOMPLETE_KEY=
```

- [ ] **Step 6: Lint and commit**

Run: `cd ecommerce-storefront && npm run lint`
Expected: clean.

```bash
git add ecommerce-storefront/src/lib/addresscomplete.ts ecommerce-storefront/src/lib/addresscomplete.test.ts ecommerce-storefront/.env.example
git commit -m "Storefront: typed Canada Post AddressComplete client"
```

---

### Task 4: Address form — Canada-locked with postal validation

**Files:**
- Modify: `ecommerce-storefront/src/components/site/AddressManager.tsx`
- Test: `ecommerce-storefront/src/components/site/AddressManager.test.tsx`

**Interfaces:**
- Consumes: nothing from Task 3 (autocomplete arrives in Task 5).
- Produces: `AddressForm` submits `AddressDto` with `country: 'CA'` always, `state` holding the province, `postalCode` normalized to `A1A 1A1`. Field ids unchanged (`address-line1` etc.); the `state` field's label is now `Province`.

- [ ] **Step 1: Update the existing tests for the Canada-locked form**

In `ecommerce-storefront/src/components/site/AddressManager.test.tsx`:

Replace both fixtures (lines 27-40) with Canadian ones:

```ts
const ADDR_1: AddressDto = {
  label: 'Home',
  line1: '1 Main St',
  city: 'Ottawa',
  state: 'ON',
  postalCode: 'K1A 0B1',
  country: 'CA',
};
const ADDR_2: AddressDto = {
  label: 'Work',
  line1: '2 Market St',
  city: 'Toronto',
  state: 'ON',
  postalCode: 'M5V 2T6',
  country: 'CA',
};
```

Replace the add-address test (lines 72-93) with:

```ts
  it('submits the whole next array (length 3) when adding a new address', async () => {
    useMeMock.mockReturnValue({ data: makeUser([ADDR_1, ADDR_2]) });
    const user = userEvent.setup();
    render(<AddressManager />);

    await user.click(screen.getByRole('button', { name: 'Add address' }));
    await user.type(screen.getByLabelText('Line 1'), '3 New St');
    await user.type(screen.getByLabelText('City'), 'Kanata');
    await user.type(screen.getByLabelText('Province'), 'ON');
    await user.type(screen.getByLabelText('Postal code'), 'k2l1t9');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mutateMock).toHaveBeenCalledTimes(1);
    const payload = mutateMock.mock.calls[0][0] as AddressDto[];
    expect(payload).toHaveLength(3);
    expect(payload[2]).toMatchObject({
      line1: '3 New St',
      city: 'Kanata',
      state: 'ON',
      postalCode: 'K2L 1T9',
      country: 'CA',
    });
  });
```

Replace the 3-letter-country test (lines 115-131) with:

```ts
  it('rejects a non-Canadian postal code with the exact message and does not submit', async () => {
    useMeMock.mockReturnValue({ data: makeUser([]) });
    const user = userEvent.setup();
    render(<AddressManager />);

    await user.click(screen.getByRole('button', { name: 'Add address' }));
    await user.type(screen.getByLabelText('Line 1'), '3 New St');
    await user.type(screen.getByLabelText('City'), 'Gotham');
    await user.type(screen.getByLabelText('Postal code'), '99999');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Enter a Canadian postal code (A1A 1A1).'),
    ).toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('shows the country as fixed Canada with no editable input', async () => {
    useMeMock.mockReturnValue({ data: makeUser([]) });
    const user = userEvent.setup();
    render(<AddressManager />);

    await user.click(screen.getByRole('button', { name: 'Add address' }));
    const country = screen.getByLabelText('Country');
    expect(country).toHaveValue('Canada');
    expect(country).toHaveAttribute('readonly');
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd ecommerce-storefront && npx vitest run src/components/site/AddressManager.test.tsx`
Expected: FAIL — no `Province` label, postal message not found, country input editable.

- [ ] **Step 3: Update AddressForm**

In `ecommerce-storefront/src/components/site/AddressManager.tsx`:

Replace the schema (lines 21-32) with:

```ts
// Canada-only store: country is fixed to CA and postal codes must be Canadian.
const POSTAL_CODE_RE = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

const schema = z.object({
  label: z.string().optional(),
  line1: z.string().min(1, 'Line 1 is required.'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required.'),
  state: z.string().optional(),
  postalCode: z
    .string()
    .regex(POSTAL_CODE_RE, 'Enter a Canadian postal code (A1A 1A1).')
    .transform((v) => {
      const compact = v.toUpperCase().replace(/[ -]/g, '');
      return `${compact.slice(0, 3)} ${compact.slice(3)}`;
    }),
});
```

In `BLANK` (lines 39-47), delete the `country: '',` line.

In `submit()` (lines 69-80), change `country: values.country,` to `country: 'CA',`.

Change the State field (lines 119-122) to:

```tsx
        <div className="grid gap-2">
          <Label htmlFor="address-state">Province</Label>
          <Input id="address-state" {...register('state')} />
        </div>
```

Replace the Country field block (lines 136-146) with:

```tsx
        <div className="grid gap-2">
          <Label htmlFor="address-country">Country</Label>
          <Input id="address-country" value="Canada" readOnly disabled />
        </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ecommerce-storefront && npx vitest run src/components/site/AddressManager.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Lint and commit**

Run: `cd ecommerce-storefront && npm run lint && npm test`
Expected: clean lint, full suite PASS.

```bash
git add ecommerce-storefront/src/components/site/AddressManager.tsx ecommerce-storefront/src/components/site/AddressManager.test.tsx
git commit -m "Storefront: address form is Canada-only with postal validation"
```

---

### Task 5: Line-1 autocomplete component wired into the form

**Files:**
- Create: `ecommerce-storefront/src/components/site/AddressAutocomplete.tsx`
- Test: `ecommerce-storefront/src/components/site/AddressAutocomplete.test.tsx`
- Modify: `ecommerce-storefront/src/components/site/AddressManager.tsx` (AddressForm only)

**Interfaces:**
- Consumes from Task 3: `findAddresses`, `retrieveAddress`, `AddressSuggestion`, `RetrievedAddress` from `@/lib/addresscomplete`.
- Consumes from Task 4: `AddressForm`'s RHF instance (adds `setValue` from `useForm`).
- Produces: `<AddressAutocomplete id ariaInvalid registration onSelect />` where `registration: UseFormRegisterReturn` and `onSelect: (address: RetrievedAddress) => void`.

- [ ] **Step 1: Write the failing component tests**

Create `ecommerce-storefront/src/components/site/AddressAutocomplete.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import type { RetrievedAddress } from '@/lib/addresscomplete';

const findAddressesMock = vi.fn();
const retrieveAddressMock = vi.fn();

vi.mock('@/lib/addresscomplete', () => ({
  findAddresses: (...args: unknown[]) => findAddressesMock(...args),
  retrieveAddress: (...args: unknown[]) => retrieveAddressMock(...args),
}));

import { AddressAutocomplete } from './AddressAutocomplete';

function Harness({ onSelect }: { onSelect: (a: RetrievedAddress) => void }) {
  const { register } = useForm<{ line1: string }>();
  return (
    <AddressAutocomplete
      id="address-line1"
      registration={register('line1')}
      onSelect={onSelect}
    />
  );
}

const SUGGESTION = {
  id: 'CA|1',
  text: '1 Main St',
  description: 'Ottawa, ON, K1A 0B1',
  next: 'Retrieve' as const,
};
const CONTAINER = {
  id: 'CA|2',
  text: '10 Apt Blvd',
  description: '24 addresses',
  next: 'Find' as const,
};
const ADDRESS: RetrievedAddress = {
  line1: '1 Main St',
  city: 'Ottawa',
  province: 'ON',
  postalCode: 'K1A 0B1',
};

beforeEach(() => {
  vi.clearAllMocks();
  findAddressesMock.mockResolvedValue([]);
});

describe('AddressAutocomplete', () => {
  it('does not search under 3 characters', async () => {
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);

    await user.type(screen.getByRole('combobox'), '1M');
    await new Promise((r) => setTimeout(r, 400));

    expect(findAddressesMock).not.toHaveBeenCalled();
  });

  it('debounces typing into a single Find call and lists suggestions', async () => {
    findAddressesMock.mockResolvedValue([SUGGESTION]);
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);

    await user.type(screen.getByRole('combobox'), '1 Main');
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /1 Main St/ })).toBeInTheDocument(),
    );

    expect(findAddressesMock).toHaveBeenCalledTimes(1);
    expect(findAddressesMock).toHaveBeenCalledWith('1 Main', undefined);
  });

  it('retrieves and reports the address when a suggestion is clicked', async () => {
    findAddressesMock.mockResolvedValue([SUGGESTION]);
    retrieveAddressMock.mockResolvedValue(ADDRESS);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSelect={onSelect} />);

    await user.type(screen.getByRole('combobox'), '1 Main');
    await user.click(
      await screen.findByRole('option', { name: /1 Main St/ }),
    );

    expect(retrieveAddressMock).toHaveBeenCalledWith('CA|1');
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(ADDRESS));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('drills into a container suggestion with a LastId Find instead of retrieving', async () => {
    findAddressesMock
      .mockResolvedValueOnce([CONTAINER])
      .mockResolvedValueOnce([SUGGESTION]);
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);

    await user.type(screen.getByRole('combobox'), '10 Apt');
    await user.click(
      await screen.findByRole('option', { name: /10 Apt Blvd/ }),
    );

    await screen.findByRole('option', { name: /1 Main St/ });
    expect(findAddressesMock).toHaveBeenLastCalledWith('10 Apt', 'CA|2');
    expect(retrieveAddressMock).not.toHaveBeenCalled();
  });

  it('supports keyboard selection with ArrowDown + Enter', async () => {
    findAddressesMock.mockResolvedValue([SUGGESTION]);
    retrieveAddressMock.mockResolvedValue(ADDRESS);
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSelect={onSelect} />);

    await user.type(screen.getByRole('combobox'), '1 Main');
    await screen.findByRole('option', { name: /1 Main St/ });
    await user.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(ADDRESS));
  });

  it('closes the dropdown on Escape and shows nothing when lookups return empty', async () => {
    findAddressesMock.mockResolvedValue([SUGGESTION]);
    const user = userEvent.setup();
    render(<Harness onSelect={vi.fn()} />);

    const input = screen.getByRole('combobox');
    await user.type(input, '1 Main');
    await screen.findByRole('option', { name: /1 Main St/ });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Empty results (e.g. no key configured) → no dropdown, typing unblocked.
    findAddressesMock.mockResolvedValue([]);
    await user.type(input, ' more');
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ecommerce-storefront && npx vitest run src/components/site/AddressAutocomplete.test.tsx`
Expected: FAIL — `./AddressAutocomplete` module not found.

- [ ] **Step 3: Implement the component**

Create `ecommerce-storefront/src/components/site/AddressAutocomplete.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import {
  findAddresses,
  retrieveAddress,
  type AddressSuggestion,
  type RetrievedAddress,
} from '@/lib/addresscomplete';
import { Input } from '@/components/ui/input';

const MIN_CHARS = 3;
const DEBOUNCE_MS = 250;

// Line-1 input with Canada Post AddressComplete suggestions. Degrades to a
// plain input when lookups return nothing (no key, offline, no matches).
export function AddressAutocomplete({
  id,
  registration,
  onSelect,
  ariaInvalid,
}: {
  id: string;
  registration: UseFormRegisterReturn;
  onSelect: (address: RetrievedAddress) => void;
  ariaInvalid?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const termRef = useRef('');
  // Increments per lookup so stale responses can't overwrite newer ones.
  const requestRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function show(items: AddressSuggestion[]) {
    setSuggestions(items);
    setActiveIndex(-1);
    setOpen(items.length > 0);
  }

  async function lookup(term: string, lastId?: string) {
    const request = ++requestRef.current;
    const items = await findAddresses(term, lastId);
    if (request === requestRef.current) show(items);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const term = e.target.value;
    termRef.current = term;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (term.trim().length < MIN_CHARS) {
      requestRef.current++;
      show([]);
      return;
    }
    debounceRef.current = setTimeout(() => void lookup(term), DEBOUNCE_MS);
  }

  async function choose(suggestion: AddressSuggestion) {
    if (suggestion.next === 'Find') {
      await lookup(termRef.current, suggestion.id);
      return;
    }
    setOpen(false);
    const address = await retrieveAddress(suggestion.id);
    if (address) onSelect(address);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) {
        e.preventDefault();
        void choose(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${id}-listbox`}
        aria-invalid={ariaInvalid}
        autoComplete="off"
        {...registration}
        onChange={(e) => {
          void registration.onChange(e);
          handleChange(e);
        }}
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          void registration.onBlur(e);
          // Delay so a click on a suggestion lands before the list closes.
          setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              role="option"
              aria-selected={index === activeIndex}
              className={`cursor-pointer px-3 py-2 text-sm ${
                index === activeIndex ? 'bg-accent text-accent-foreground' : ''
              }`}
              // mousedown fires before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                void choose(suggestion);
              }}
            >
              <span>{suggestion.text}</span>
              {suggestion.description && (
                <span className="ml-2 text-muted-foreground">
                  {suggestion.description}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run component tests to verify they pass**

Run: `cd ecommerce-storefront && npx vitest run src/components/site/AddressAutocomplete.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Wire it into AddressForm**

In `ecommerce-storefront/src/components/site/AddressManager.tsx`:

Add imports:

```ts
import { AddressAutocomplete } from '@/components/site/AddressAutocomplete';
```

In `AddressForm`, destructure `setValue` from `useForm` (it currently takes `register, handleSubmit, formState`):

```ts
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: initial ? { ...BLANK, ...initial } : BLANK,
  });
```

Replace the Line 1 `<Input …>` (inside the `address-line1` grid div) with:

```tsx
        <AddressAutocomplete
          id="address-line1"
          ariaInvalid={!!errors.line1}
          registration={register('line1')}
          onSelect={(address) => {
            setValue('line1', address.line1, { shouldValidate: true });
            setValue('line2', address.line2 ?? '');
            setValue('city', address.city, { shouldValidate: true });
            setValue('state', address.province);
            setValue('postalCode', address.postalCode, {
              shouldValidate: true,
            });
          }}
        />
```

- [ ] **Step 6: Add a form-level test proving selection fills the fields**

Append to the `describe` block in `ecommerce-storefront/src/components/site/AddressManager.test.tsx` (the file already mocks `@/api/hooks/account`; add the `@/lib/addresscomplete` mock next to it at the top of the file):

At the top, after the existing `vi.mock('@/api/hooks/account', …)` block:

```ts
const findAddressesMock = vi.fn();
const retrieveAddressMock = vi.fn();

vi.mock('@/lib/addresscomplete', () => ({
  findAddresses: (...args: unknown[]) => findAddressesMock(...args),
  retrieveAddress: (...args: unknown[]) => retrieveAddressMock(...args),
}));
```

And in `beforeEach`, after `vi.clearAllMocks()`:

```ts
  findAddressesMock.mockResolvedValue([]);
```

New test at the end of the describe block:

```ts
  it('fills city, province, and postal code when an autocomplete suggestion is chosen', async () => {
    useMeMock.mockReturnValue({ data: makeUser([]) });
    findAddressesMock.mockResolvedValue([
      {
        id: 'CA|1',
        text: '1 Main St',
        description: 'Ottawa, ON, K1A 0B1',
        next: 'Retrieve',
      },
    ]);
    retrieveAddressMock.mockResolvedValue({
      line1: '1 Main St',
      city: 'Ottawa',
      province: 'ON',
      postalCode: 'K1A 0B1',
    });
    const user = userEvent.setup();
    render(<AddressManager />);

    await user.click(screen.getByRole('button', { name: 'Add address' }));
    await user.type(screen.getByLabelText('Line 1'), '1 Main');
    await user.click(await screen.findByRole('option', { name: /1 Main St/ }));

    await waitFor(() =>
      expect(screen.getByLabelText('Postal code')).toHaveValue('K1A 0B1'),
    );
    expect(screen.getByLabelText('Line 1')).toHaveValue('1 Main St');
    expect(screen.getByLabelText('City')).toHaveValue('Ottawa');
    expect(screen.getByLabelText('Province')).toHaveValue('ON');
  });
```

Add `waitFor` to the existing `@testing-library/react` import.

- [ ] **Step 7: Run the full storefront suite**

Run: `cd ecommerce-storefront && npm run lint && npm test`
Expected: lint clean, all tests PASS (including the 8 AddressManager tests).

- [ ] **Step 8: Commit**

```bash
git add ecommerce-storefront/src/components/site/AddressAutocomplete.tsx ecommerce-storefront/src/components/site/AddressAutocomplete.test.tsx ecommerce-storefront/src/components/site/AddressManager.tsx ecommerce-storefront/src/components/site/AddressManager.test.tsx
git commit -m "Storefront: Canada Post autocomplete on the address form"
```

---

### Task 6: Full verification sweep

**Files:** none new.

**Interfaces:** n/a — verification only.

- [ ] **Step 1: API suite**

Run: `cd ecommerce-api && npm test`
Expected: PASS.

- [ ] **Step 2: Storefront suite + build**

Run: `cd ecommerce-storefront && npm test && NEXT_PUBLIC_API_URL=http://localhost:3002 npm run build`
Expected: tests PASS; build succeeds. **Do not run the build if `next dev` is running against this repo — stop the stack first (`./stop-stack.sh`) and restart it after.**

- [ ] **Step 3: Manual smoke (stack already running via start-stack.sh)**

With the stack up: sign in as a shopper at http://localhost:3005/account, add an address — confirm Country shows a fixed "Canada", the label reads "Province", postal `99999` is rejected, `k1a0b1` saves as `K1A 0B1`. With no AddressComplete key set, typing in Line 1 must show no dropdown and no console errors.

- [ ] **Step 4: Commit any stragglers**

```bash
git status --short
```
Expected: clean (everything committed in Tasks 1-5).
