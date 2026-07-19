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

      <section className="container-wide py-16">
        <div className="flex flex-wrap gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-56 rounded-xl" />
          ))}
        </div>
      </section>

      <section className="container-wide py-16">
        <Skeleton className="h-3 w-28" />
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
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
