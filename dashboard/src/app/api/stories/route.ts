import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { starStories } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const stories = await db
      .select()
      .from(starStories)
      .where(eq(starStories.tenantId, session.tenantId))
      .orderBy(desc(starStories.createdAt));

    return NextResponse.json({ stories });
  } catch (error) {
    console.error("Failed to fetch stories:", error);
    return NextResponse.json({ error: "Failed to fetch stories" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { situation, task, action, result, skillsDemonstrated, rolesApplicable } = body;

    if (!situation || !task || !action || !result) {
      return NextResponse.json(
        { error: "situation, task, action, and result are required" },
        { status: 400 }
      );
    }

    const inserted = await db
      .insert(starStories)
      .values({
        tenantId: session.tenantId,
        situation,
        task,
        action,
        result,
        skillsDemonstrated: skillsDemonstrated || [],
        rolesApplicable: rolesApplicable || [],
      })
      .returning();

    return NextResponse.json({ story: inserted[0] });
  } catch (error) {
    console.error("Failed to create story:", error);
    return NextResponse.json({ error: "Failed to create story" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const storyId = searchParams.get("id");

    if (!storyId) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    await db
      .delete(starStories)
      .where(
        and(
          eq(starStories.id, storyId),
          eq(starStories.tenantId, session.tenantId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete story:", error);
    return NextResponse.json({ error: "Failed to delete story" }, { status: 500 });
  }
}
