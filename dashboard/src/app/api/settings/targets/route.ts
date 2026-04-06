import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const result = await db.execute(
      `SELECT search_config FROM tenants WHERE id = '${session.tenantId}'`
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    const searchConfig = (row?.search_config as Record<string, unknown>) || {};
    const targetCompanies = (searchConfig.targetCompanies as unknown[]) || [];

    return NextResponse.json({ targetCompanies });
  } catch (error) {
    console.error("Failed to fetch target companies:", error);
    return NextResponse.json({ error: "Failed to fetch targets" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { targetCompanies } = await request.json();

    // Read existing search_config, merge targetCompanies into it
    const result = await db.execute(
      `SELECT search_config FROM tenants WHERE id = '${session.tenantId}'`
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    const existing = (row?.search_config as Record<string, unknown>) || {};
    const updated = { ...existing, targetCompanies };

    await db.execute(
      `UPDATE tenants SET search_config = '${JSON.stringify(updated).replace(/'/g, "''")}'::jsonb WHERE id = '${session.tenantId}'`
    );

    return NextResponse.json({ success: true, targetCompanies });
  } catch (error) {
    console.error("Failed to update target companies:", error);
    return NextResponse.json({ error: "Failed to update targets" }, { status: 500 });
  }
}
