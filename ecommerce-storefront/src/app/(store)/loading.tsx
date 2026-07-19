import { Skeleton } from '@/components/ui/skeleton';

export default function HomeLoading() {
  return (
    <>
      <section className="bg-subtle">
        <div className="container-wide grid max-w-[150rem] gap-12 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full max-w-sm" />
            <Skeleton className="h-10 w-2/3 max-w-xs" />
            <Skeleton className="h-4 w-full max-w-xs" />
            <Skeleton className="mt-6 h-10 w-32" />
          </div>
          <Skeleton className="h-72 w-full sm:h-96 lg:h-[30rem]" />
        </div>
      </section>
      <div className="selvedge" />

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
