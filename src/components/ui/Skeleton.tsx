import { cn } from '@/lib/utils';

/** Shape-matched placeholder. Never a full-page spinner (§50). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-[var(--radius-card)] bg-[var(--dhoop-2)]',
        className
      )}
    />
  );
}

export function GanpatiCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)]">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}
