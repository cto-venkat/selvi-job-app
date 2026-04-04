import { db } from "./db";
import { tenants } from "./schema";
import { eq } from "drizzle-orm";

/**
 * Resolve a Clerk user ID to a tenant ID.
 * In production, this is called on every authenticated request
 * to scope all data queries to the correct tenant.
 */
export async function resolveTenantId(clerkUserId: string): Promise<string | null> {
  try {
    const rows = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.clerkUserId, clerkUserId))
      .limit(1);

    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the current tenant ID from the request context.
 * Falls back to a default tenant ID for development / demo mode.
 */
export async function getCurrentTenantId(): Promise<string> {
  // In production, extract from Clerk session:
  // const { userId } = auth();
  // const tenantId = await resolveTenantId(userId);

  // For development / demo mode, return a fixed tenant ID
  return "t-0001";
}
