import { Card, CardContent, CardHeader } from "@/components/ui/card";

function SkeletonBar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? "h-4 w-full"}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <SkeletonBar className="h-7 w-32" />
        <SkeletonBar className="h-4 w-48" />
      </div>

      {/* Today cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <SkeletonBar className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <SkeletonBar className="h-4 w-full" />
              <SkeletonBar className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Activity */}
      <Card>
        <CardContent className="py-6 space-y-3">
          <SkeletonBar className="h-4 w-48" />
          <SkeletonBar className="h-3 w-full" />
          <SkeletonBar className="h-3 w-4/5" />
        </CardContent>
      </Card>

      {/* Pipeline */}
      <Card>
        <CardContent className="py-6">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonBar key={i} className="h-16 w-24 rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="py-6 space-y-2">
              <SkeletonBar className="h-3 w-20" />
              <SkeletonBar className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
