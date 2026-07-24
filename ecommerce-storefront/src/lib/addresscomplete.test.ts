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
