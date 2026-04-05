import { NextResponse } from "next/server";
import { testConnection } from "@/lib/db";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "NOT SET";
  const masked = dbUrl.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");

  let dbStatus = "unknown";
  let dbError = "";

  try {
    const connected = await testConnection();
    dbStatus = connected ? "connected" : "failed";
  } catch (e: unknown) {
    dbStatus = "error";
    dbError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    status: "ok",
    database: {
      url: masked,
      status: dbStatus,
      error: dbError || undefined,
    },
    env: {
      NODE_ENV: process.env.NODE_ENV,
      hasClerkPK: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      hasClerkSK: !!process.env.CLERK_SECRET_KEY,
    },
    timestamp: new Date().toISOString(),
  });
}
