import { NextResponse } from "next/server";

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    // In production: update tenant profile in DB
    // const tenantId = await getCurrentTenantId();
    // await db.update(tenants).set(body).where(eq(tenants.id, tenantId));
    return NextResponse.json({ success: true, profile: body });
  } catch {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
