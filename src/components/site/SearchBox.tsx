import { Search } from 'lucide-react';

export function SearchBox() {
  return (
    <form action="/products" method="GET" role="search" className="relative">
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink/50"
      />
      <input
        id="site-search"
        type="search"
        name="q"
        placeholder="Search"
        className="w-full max-w-48 rounded-none border border-ink/20 bg-cotton py-1.5 pr-3 pl-8 text-sm text-ink placeholder:text-ink/40 focus-visible:outline-2 focus-visible:outline-indigo"
      />
    </form>
  );
}
