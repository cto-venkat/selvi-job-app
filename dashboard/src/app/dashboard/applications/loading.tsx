import { Card, CardContent } from "@/components/ui/card";

function SkeletonBar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? "h-4 w-full"}`} />;
}

export default function ApplicationsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonBar className="h-7 w-40" />
        <SkeletonBar className="h-4 w-32" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonBar key={i} className="h-6 w-20 rounded-md" />
        ))}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((col) => (
          <div key={col} className="space-y-3">
            <SkeletonBar className="h-12 rounded-lg" />
            {[1, 2].map((card) => (
              <Card key={card}>
                <CardContent className="p-3 space-y-2">
                  <SkeletonBar className="h-4 w-24" />
                  <SkeletonBar className="h-3 w-32" />
                  <SkeletonBar className="h-4 w-16 rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
