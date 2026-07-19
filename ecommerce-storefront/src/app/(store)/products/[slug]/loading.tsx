import { Skeleton } from '@/components/ui/skeleton';

export default function ProductLoading() {
  return (
    <div className="container-wide py-12">
      <div className="grid gap-10 md:grid-cols-2 md:items-start">
        <div>
          <Skeleton className="aspect-3/4 w-full" />
          <div className="mt-3 grid grid-cols-5 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-3/4 w-full" />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
