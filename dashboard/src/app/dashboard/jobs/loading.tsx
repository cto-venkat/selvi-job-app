import { Card, CardContent } from "@/components/ui/card";

function SkeletonBar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? "h-4 w-full"}`} />;
}

export default function JobsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonBar className="h-7 w-32" />
        <SkeletonBar className="h-4 w-48" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <SkeletonBar className="h-8 w-64" />
        <SkeletonBar className="h-8 w-28" />
        <SkeletonBar className="h-8 w-28" />
        <SkeletonBar className="h-8 w-28" />
      </div>

      {/* Table skeleton */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {/* Header */}
            <div className="flex gap-4 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonBar key={i} className="h-4 w-20" />
              ))}
            </div>
            {/* Rows */}
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <SkeletonBar className="h-4 w-48" />
                <SkeletonBar className="h-4 w-24" />
                <SkeletonBar className="h-5 w-10 rounded-full" />
                <SkeletonBar className="h-4 w-12" />
                <SkeletonBar className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
