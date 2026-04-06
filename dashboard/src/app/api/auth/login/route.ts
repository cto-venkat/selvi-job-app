import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password required" },
      { status: 400 }
    );
  }

  const session = await authenticate(email, password);

  if (!session) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  return NextResponse.json({ success: true, user: session });
}
