"use client";

import { useState } from "react";
import { useData } from "@/lib/use-data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileCheck, Eye, Download, Loader2, AlertCircle, Send, X } from "lucide-react";

const statusConfig: Record<string, { label: string; icon: typeof FileCheck; class: string }> = {
  ready: {
    label: "Ready",
    icon: FileCheck,
    class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  generating: {
    label: "Generating...",
    icon: Loader2,
    class: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  sent: {
    label: "Sent",
    icon: Send,
    class: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    class: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
};


function formatDate(d: Date | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function downloadCv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CvPage() {
  const { data: packages, loading } = useData<any>("cv-packages");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const previewPkg = previewId ? packages.find((p: any) => p.id === previewId) : null;
  const previewContent = "No content available.";

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CV Packages</h1>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CV Packages</h1>
          <p className="text-sm text-muted-foreground">AI-generated tailored CVs</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <FileCheck className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">No CV packages yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Head to Jobs to find matches -- CVs will be generated automatically for A-tier jobs.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">CV Packages</h1>
        <p className="text-sm text-muted-foreground">
          {packages.length} tailored CV package{packages.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => {
          const cfg = statusConfig[pkg.status] ?? statusConfig.ready;
          const StatusIcon = cfg.icon;

          return (
            <Card key={pkg.id} className="relative overflow-hidden">
              {/* Match bar */}
              <div
                className="absolute top-0 left-0 h-1 bg-cyan-500"
                style={{ width: `${pkg.matchPercentage}%` }}
              />
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold leading-tight">{pkg.jobTitle}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{pkg.company}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${cfg.class}`}>
                    <StatusIcon className={`h-3 w-3 mr-1 ${pkg.status === "generating" ? "animate-spin" : ""}`} />
                    {cfg.label}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                    {pkg.matchPercentage}% match
                  </span>
                  <span className="text-muted-foreground">{pkg.cvType}</span>
                  <span className="text-muted-foreground">{formatDate(pkg.createdAt)}</span>
                </div>

                {pkg.highlights && pkg.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {pkg.highlights.map((h: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {h}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={pkg.status === "generating"}
                    onClick={() => setPreviewId(pkg.id)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={pkg.status === "generating"}
                    onClick={() => {
                      const content = "No content available.";
                      const filename = `CV - ${pkg.company} ${pkg.jobTitle}.txt`;
                      downloadCv(filename, content);
                    }}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewId} onOpenChange={(open) => { if (!open) setPreviewId(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {previewPkg ? `CV Preview -- ${previewPkg.company} ${previewPkg.jobTitle}` : "CV Preview"}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-muted/30 rounded-md p-4 font-mono text-xs whitespace-pre-wrap leading-relaxed border">
            {previewContent}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (previewPkg) {
                  const content = previewContent;
                  downloadCv(`CV - ${previewPkg.company} ${previewPkg.jobTitle}.txt`, content);
                }
              }}
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreviewId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
