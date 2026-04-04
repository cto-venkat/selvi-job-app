import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    // In production: insert note into DB
    // const tenantId = await getCurrentTenantId();
    // await db.insert(applicationNotes).values({ applicationId: id, tenantId, text: body.text });
    return NextResponse.json({ success: true, applicationId: id, note: body }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 });
  }
}
