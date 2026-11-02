import { Skeleton } from "@/components/ui/skeleton";

/** Toolbar and card placeholders while the library loads. */
export function VideoLibrarySkeleton() {
  return (
    <div role="status" aria-label="Loading your videos" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-12 flex-1" />
        <Skeleton className="h-11 sm:w-56" />
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex flex-col gap-3 rounded-card border border-border bg-card p-3">
            <Skeleton className="mx-auto aspect-9/16 w-full max-w-44" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </li>
        ))}
      </ul>
    </div>
  );
}
