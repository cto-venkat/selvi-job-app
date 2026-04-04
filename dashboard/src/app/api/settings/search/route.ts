import { NextResponse } from "next/server";

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    // In production: update search config in DB
    // const tenantId = await getCurrentTenantId();
    // await db.update(searchConfigs).set(body).where(eq(searchConfigs.tenantId, tenantId));
    return NextResponse.json({ success: true, searchConfig: body });
  } catch {
    return NextResponse.json({ error: "Failed to update search config" }, { status: 500 });
  }
}
