import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    // In production: update in DB with tenant scoping
    // const tenantId = await getCurrentTenantId();
    // await db.update(jobs).set(body).where(and(eq(jobs.id, id), eq(jobs.tenantId, tenantId)));
    return NextResponse.json({ success: true, id, updated: body });
  } catch {
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
  }
}
