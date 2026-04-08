import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const result = await db.execute(
      sql`SELECT candidate_profile, search_config FROM tenants WHERE id = ${session.tenantId}`
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;

    if (!row) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const candidateProfile = (row.candidate_profile as Record<string, unknown>) || {};
    const searchConfig = (row.search_config as Record<string, unknown>) || {};

    return NextResponse.json({
      candidateProfile,
      searchConfig,
      // Include tenant-level fields
      tenantName: session.name,
      tenantEmail: session.email,
    });
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { candidateProfile, searchConfig } = body;

    // Update candidate_profile and search_config JSONB columns via parameterized SQL
    // These columns exist in Postgres but not in the Drizzle schema
    if (candidateProfile !== undefined && searchConfig !== undefined) {
      await db.execute(
        sql`UPDATE tenants SET candidate_profile = ${JSON.stringify(candidateProfile)}::jsonb, search_config = ${JSON.stringify(searchConfig)}::jsonb WHERE id = ${session.tenantId}`
      );
    } else if (candidateProfile !== undefined) {
      await db.execute(
        sql`UPDATE tenants SET candidate_profile = ${JSON.stringify(candidateProfile)}::jsonb WHERE id = ${session.tenantId}`
      );
    } else if (searchConfig !== undefined) {
      await db.execute(
        sql`UPDATE tenants SET search_config = ${JSON.stringify(searchConfig)}::jsonb WHERE id = ${session.tenantId}`
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
