"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { mockInterviews, mockPrepBriefs } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Video,
  Phone,
  DollarSign,
  MessageSquare,
  CheckCircle,
  BookOpen,
  Navigation,
  AlertTriangle,
} from "lucide-react";

const locationIcons: Record<string, typeof Video> = {
  video: Video,
  in_person: MapPin,
  phone: Phone,
};

function formatDate(d: Date | string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function InterviewPrepPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [completed, setCompleted] = useState(false);

  const interview = mockInterviews.find((iv) => iv.id === id);
  const prep = mockPrepBriefs[id];

  if (!interview) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/interviews")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Interviews
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Interview not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const LocationIcon = locationIcons[interview.locationType ?? "video"] ?? Video;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/interviews")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Interviews
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{interview.companyName}</h1>
          <p className="text-muted-foreground">{interview.roleTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {interview.locationType === "video" && interview.videoLink && (
            <a href={interview.videoLink} target="_blank" rel="noreferrer">
              <Button>
                <Video className="h-4 w-4 mr-1" /> Join Call
              </Button>
            </a>
          )}
          <Button
            variant={completed ? "secondary" : "outline"}
            onClick={() => setCompleted(!completed)}
          >
            <CheckCircle className={`h-4 w-4 mr-1 ${completed ? "text-emerald-500" : ""}`} />
            {completed ? "Completed" : "Mark Complete"}
          </Button>
        </div>
      </div>

      {/* Interview Details */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card size="sm">
          <CardContent className="p-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Date</p>
              <p className="text-sm font-medium">{formatDate(interview.interviewDate)}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="p-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Time</p>
              <p className="text-sm font-medium">{interview.interviewStartTime}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="p-3 flex items-center gap-2">
            <LocationIcon className="h-4 w-4 text-cyan-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Location</p>
              <p className="text-sm font-medium capitalize">{interview.locationType?.replace("_", " ")}</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="p-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Format</p>
              <p className="text-sm font-medium capitalize">{interview.interviewFormat?.replace("_", " ")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {prep ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Company Research */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Company Research
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{prep.companyResearch}</p>
              </CardContent>
            </Card>

            {/* Role Insights */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Role Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{prep.roleInsights}</p>
              </CardContent>
            </Card>

            {/* Likely Questions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Likely Questions & STAR Examples
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {prep.likelyQuestions.map((q, i) => (
                  <div key={i} className="rounded-md border border-border p-4 space-y-2">
                    <p className="text-sm font-semibold">Q: {q.question}</p>
                    <div className="rounded bg-muted/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">STAR Example</p>
                      <p className="text-sm leading-relaxed">{q.starExample}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Salary Intel */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Salary Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{prep.salaryIntelligence}</p>
              </CardContent>
            </Card>

            {/* Travel/Logistics */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Navigation className="h-4 w-4" /> Travel & Logistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{prep.travelLogistics}</p>
                {interview.physicalAddress && (
                  <div className="mt-3">
                    <Badge variant="outline" className="text-xs">
                      <MapPin className="h-3 w-3 mr-1" />
                      {interview.physicalAddress}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Debrief */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Post-Interview Debrief
                </CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  placeholder="How did it go? Record your thoughts here..."
                  className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button size="sm" className="mt-2 w-full">Save Debrief</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">No prep brief available yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              A prep brief will be generated automatically as the interview date approaches.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
