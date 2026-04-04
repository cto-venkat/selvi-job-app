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
    // await db.update(applications).set(body).where(and(eq(applications.id, id), eq(applications.tenantId, tenantId)));
    return NextResponse.json({ success: true, id, updated: body });
  } catch {
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }
}
