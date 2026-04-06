import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
import { tenants } from "./schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "jobpilot-dev-secret-change-in-prod"
);
const COOKIE_NAME = "jobpilot_session";

export type SessionUser = {
  tenantId: string;
  email: string;
  name: string;
};

// Hardcoded users — personal tool, 2 users only
const USERS: Record<string, { password: string; tenantSlug: string }> = {
  "chellamma.uk@gmail.com": {
    password: process.env.AUTH_PASSWORD_SELVI || "changeme",
    tenantSlug: "selvi",
  },
  "venkat.fts@gmail.com": {
    password: process.env.AUTH_PASSWORD_VENKAT || "changeme",
    tenantSlug: "venkat",
  },
};

export async function authenticate(
  email: string,
  password: string
): Promise<SessionUser | null> {
  const user = USERS[email.toLowerCase()];
  if (!user || user.password !== password) {
    return null;
  }

  // Look up tenant by email
  const rows = await db
    .select({ id: tenants.id, name: tenants.name, email: tenants.email })
    .from(tenants)
    .where(eq(tenants.email, email.toLowerCase()))
    .limit(1);

  if (!rows[0]) return null;

  const session: SessionUser = {
    tenantId: rows[0].id,
    email: rows[0].email || email,
    name: rows[0].name || email.split("@")[0],
  };

  // Create JWT and set cookie
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return session;
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      tenantId: payload.tenantId as string,
      email: payload.email as string,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

export async function getCurrentTenantId(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }
  return session.tenantId;
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
