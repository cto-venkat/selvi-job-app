import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // In production: insert into DB with tenant scoping
    // const tenantId = await getCurrentTenantId();
    // await db.insert(applications).values({ ...body, tenantId });
    return NextResponse.json({ success: true, data: body }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create application" }, { status: 500 });
  }
}
