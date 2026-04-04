import { Card, CardContent } from "@/components/ui/card";

function SkeletonBar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? "h-4 w-full"}`} />;
}

export default function InterviewsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonBar className="h-7 w-32" />
        <SkeletonBar className="h-4 w-48" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-muted animate-pulse" />
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <SkeletonBar className="h-5 w-28" />
                  <SkeletonBar className="h-4 w-40" />
                </div>
                <SkeletonBar className="h-5 w-20 rounded-full" />
              </div>
              <div className="flex gap-4">
                <SkeletonBar className="h-4 w-40" />
                <SkeletonBar className="h-4 w-16" />
              </div>
              <div className="flex gap-3">
                <SkeletonBar className="h-5 w-20 rounded-full" />
                <SkeletonBar className="h-4 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
