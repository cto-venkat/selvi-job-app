"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/data?type=interviews`)
      .then((r) => r.json())
      .then((d) => {
        const interviews = d.data || [];
        const found = interviews.find((iv: any) => iv.id === id);
        if (found) {
          setInterview({
            ...found,
            companyName: found.companyName ?? found.company_name,
            roleTitle: found.roleTitle ?? found.role_title,
            interviewFormat: found.interviewFormat ?? found.interview_format,
            interviewDate: found.interviewDate ?? found.interview_date,
            interviewStartTime: found.interviewStartTime ?? found.interview_start_time,
            locationType: found.locationType ?? found.location_type,
            videoLink: found.videoLink ?? found.video_link,
            physicalAddress: found.physicalAddress ?? found.physical_address,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/interviews")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Interviews
        </Button>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

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

      <Card>
        <CardContent className="py-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">No prep brief available yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            A prep brief will be generated automatically as the interview date approaches.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
