import { Skeleton } from '@/components/ui/skeleton';

export default function HomeLoading() {
  return (
    <>
      <div className="px-3 pt-3">
        <Skeleton className="h-[78vh] min-h-105 w-full rounded-2xl sm:h-[88vh]" />
      </div>
      <div className="selvedge mt-3" />

      {/* Brand marquee row */}
      <section className="overflow-hidden py-10">
        <div className="flex gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-44 shrink-0 rounded-xl" />
          ))}
        </div>
      </section>

      {/* Product-type boxes */}
      <section className="container-wide py-10">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      </section>

      {/* All-products crawl */}
      <section className="overflow-hidden py-16">
        <div className="container-wide">
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="mt-6 flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[calc((100vw-6rem)/5)] min-w-52 shrink-0 space-y-3">
              <Skeleton className="aspect-3/4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
