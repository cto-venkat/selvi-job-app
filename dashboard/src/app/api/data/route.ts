import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getApplications,
  getInterviews,
  getCvPackages,
  getEmails,
  getWeeklyMetrics,
  getContentCalendar,
} from "@/lib/queries";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  try {
    switch (type) {
      case "applications": {
        const apps = await getApplications(session.tenantId);
        return NextResponse.json({ data: apps });
      }
      case "interviews": {
        const interviews = await getInterviews(session.tenantId);
        return NextResponse.json({ data: interviews });
      }
      case "cv-packages": {
        const packages = await getCvPackages(session.tenantId);
        return NextResponse.json({ data: packages });
      }
      case "emails": {
        const emails = await getEmails(session.tenantId);
        return NextResponse.json({ data: emails });
      }
      case "metrics": {
        const metrics = await getWeeklyMetrics(session.tenantId);
        return NextResponse.json({ data: metrics });
      }
      case "content-calendar": {
        const calendar = await getContentCalendar(session.tenantId);
        return NextResponse.json({ data: calendar });
      }
      default:
        return NextResponse.json(
          { error: "Invalid type parameter" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Data API error (${type}):`, error);
    return NextResponse.json(
      { error: "Database query failed" },
      { status: 500 }
    );
  }
}
