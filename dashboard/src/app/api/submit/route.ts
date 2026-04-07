import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getJobById } from "@/lib/queries";
import { detectAts } from "@/lib/ats/detector";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * POST /api/submit — Submit a job application
 *
 * For Greenhouse/Lever: calls their public apply API directly
 * For others: creates an application record and returns copy-paste instructions
 *
 * Requires human approval — the client must confirm before calling this.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { jobId, method, payload } = await request.json();

  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const job = await getJobById(session.tenantId, jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const atsInfo = job.url ? detectAts(job.url) : null;

  try {
    // Track the application in DB regardless of submission method
    await db.execute(sql`
      INSERT INTO applications (tenant_id, job_id, company_name, job_title, current_state, discovery_source, applied_at)
      VALUES (${session.tenantId}, ${jobId}, ${job.company}, ${job.title}, 'applied', ${atsInfo?.platform || 'manual'}, NOW())
      ON CONFLICT DO NOTHING
    `);

    if (method === "greenhouse" && atsInfo?.platform === "greenhouse") {
      // Greenhouse API submission
      const boardToken = atsInfo.company;
      const ghJobId = atsInfo.jobId;

      if (!boardToken || !ghJobId || !payload) {
        return NextResponse.json(
          { error: "Missing Greenhouse board token, job ID, or payload" },
          { status: 400 }
        );
      }

      const ghResponse = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${ghJobId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (ghResponse.ok) {
        const result = await ghResponse.json();
        // Update application status
        await db.execute(sql`
          UPDATE applications SET current_state = 'applied'
          WHERE tenant_id = ${session.tenantId} AND job_id = ${jobId}
        `);
        return NextResponse.json({
          success: true,
          method: "greenhouse-api",
          result,
        });
      } else {
        const err = await ghResponse.text();
        return NextResponse.json(
          { error: `Greenhouse API error: ${err}` },
          { status: ghResponse.status }
        );
      }
    } else if (method === "lever" && atsInfo?.platform === "lever") {
      // Lever API submission
      const site = atsInfo.company;
      const postingId = atsInfo.jobId;

      if (!site || !postingId || !payload) {
        return NextResponse.json(
          { error: "Missing Lever site, posting ID, or payload" },
          { status: 400 }
        );
      }

      const leverResponse = await fetch(
        `https://api.lever.co/v0/postings/${site}/${postingId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (leverResponse.ok) {
        const result = await leverResponse.json();
        await db.execute(sql`
          UPDATE applications SET current_state = 'applied'
          WHERE tenant_id = ${session.tenantId} AND job_id = ${jobId}
        `);
        return NextResponse.json({
          success: true,
          method: "lever-api",
          result,
        });
      } else {
        const err = await leverResponse.text();
        return NextResponse.json(
          { error: `Lever API error: ${err}` },
          { status: leverResponse.status }
        );
      }
    } else {
      // Manual submission — just track it
      await db.execute(sql`
        UPDATE applications SET current_state = 'applied'
        WHERE tenant_id = ${session.tenantId} AND job_id = ${jobId}
      `);
      return NextResponse.json({
        success: true,
        method: "manual",
        message: "Application recorded. Use the copy-paste package to apply on the portal.",
      });
    }
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Submission failed" },
      { status: 500 }
    );
  }
}
