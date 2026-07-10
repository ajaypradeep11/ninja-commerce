// Server-component fetch options: always fresh (live stock/prices).
//
// The generated `client.gen.ts` (hey-api fetch client) builds `RequestInit`
// by spreading the per-call options object it receives straight into
// `new Request(url, requestInit)` (see `src/api/generated/client/client.gen.ts`).
// Its `Config`/`RequestOptions` types extend
// `Omit<RequestInit, 'body' | 'headers' | 'method'>`, so any standard
// `RequestInit` field — including `cache` — is accepted directly as a
// top-level property of the options object passed to an SDK function, e.g.:
//
//   productsControllerFindAll({ query, ...serverFetchOptions })
//
// No `fetch: undefined` passthrough is required for this to work.
export const serverFetchOptions = { cache: 'no-store' } as const;
