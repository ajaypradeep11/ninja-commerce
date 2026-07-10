import Link from 'next/link';

type SearchParamsRecord = Record<string, string | string[] | undefined>;

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  searchParams: SearchParamsRecord;
}

function buildHref(basePath: string, searchParams: SearchParamsRecord, page: number): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'page' || value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => qs.append(key, v));
    } else {
      qs.set(key, value);
    }
  }
  qs.set('page', String(page));
  return `${basePath}?${qs.toString()}`;
}

export function Pagination({ page, total, pageSize, basePath, searchParams }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-6">
      {hasPrev ? (
        <Link
          href={buildHref(basePath, searchParams, page - 1)}
          className="font-mono text-xs tracking-wide text-ink hover:text-indigo"
        >
          Prev
        </Link>
      ) : (
        <span aria-disabled="true" className="font-mono text-xs tracking-wide text-ink/30">
          Prev
        </span>
      )}
      <span className="font-mono text-xs tracking-wide text-ink/70">
        Page {page} of {totalPages}
      </span>
      {hasNext ? (
        <Link
          href={buildHref(basePath, searchParams, page + 1)}
          className="font-mono text-xs tracking-wide text-ink hover:text-indigo"
        >
          Next
        </Link>
      ) : (
        <span aria-disabled="true" className="font-mono text-xs tracking-wide text-ink/30">
          Next
        </span>
      )}
    </nav>
  );
}
