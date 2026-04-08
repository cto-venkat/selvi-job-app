import { NextResponse } from "next/server";
import { testConnection } from "@/lib/db";

export async function GET() {
  let dbStatus = "unknown";
  let dbError = "";

  try {
    const connected = await testConnection();
    dbStatus = connected ? "connected" : "disconnected";
  } catch (e: unknown) {
    dbStatus = "disconnected";
    dbError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    status: "ok",
    database: {
      status: dbStatus,
      error: dbError || undefined,
    },
    env: {
      NODE_ENV: process.env.NODE_ENV,
    },
    timestamp: new Date().toISOString(),
  });
}
