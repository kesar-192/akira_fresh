import { getAuth } from "@clerk/express";
import { and, count, eq, sql } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db, teamMembersTable } from "@workspace/db";

export type Actor = typeof teamMembersTable.$inferSelect;

declare global {
  namespace Express {
    interface Locals {
      actor?: Actor;
    }
  }
}

async function getClerkIdentity(userId: string): Promise<{ email: string; name: string | null }> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("Clerk server credentials are not configured.");

  const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Clerk user lookup failed (${response.status}).`);

  const user = (await response.json()) as {
    email_addresses?: Array<{ id?: string; email_address?: string }>;
    primary_email_address_id?: string;
    first_name?: string | null;
    last_name?: string | null;
  };
  const email =
    user.email_addresses?.find((entry) => entry.id === user.primary_email_address_id)?.email_address ??
    user.email_addresses?.[0]?.email_address;
  if (!email) throw new Error("The signed-in account has no verified email address.");
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || null;
  return { email: email.toLowerCase(), name };
}

export async function attachActor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Sign in to access this workspace." });
      return;
    }

    const [existing] = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.clerkUserId, userId))
      .limit(1);
    if (existing) {
      res.locals.actor = existing;
      next();
      return;
    }

    const identity = await getClerkIdentity(userId);
    const [matchingMember] = await db
      .select()
      .from(teamMembersTable)
      .where(sql`lower(${teamMembersTable.email}) = ${identity.email}`)
      .limit(1);

    if (matchingMember) {
      const [activated] = await db
        .update(teamMembersTable)
        .set({
          clerkUserId: userId,
          name: matchingMember.name ?? identity.name,
          status: "active",
        })
        .where(eq(teamMembersTable.id, matchingMember.id))
        .returning();
      res.locals.actor = activated;
      next();
      return;
    }

    const [adminCount] = await db
      .select({ value: count() })
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.role, "agency_admin"), eq(teamMembersTable.status, "active")));
    const [created] = await db
      .insert(teamMembersTable)
      .values({
        clerkUserId: userId,
        email: identity.email,
        name: identity.name,
        role: adminCount.value === 0 ? "agency_admin" : "team_member",
        brandIds: [],
        status: "active",
      })
      .returning();
    res.locals.actor = created;
    next();
  } catch (error) {
    req.log.error({ err: error }, "Unable to resolve workspace member");
    res.status(503).json({ error: "Unable to load your workspace profile. Please try again." });
  }
}

export function requireAgencyAdmin(req: Request, res: Response, next: NextFunction): void {
  if (res.locals.actor?.role !== "agency_admin") {
    res.status(403).json({ error: "Agency admin access is required." });
    return;
  }
  next();
}

export function actorFor(res: Response): Actor {
  const actor = res.locals.actor;
  if (!actor) throw new Error("Authenticated workspace member is missing.");
  return actor;
}

export function canAccessBrand(actor: Actor, brandId: number): boolean {
  return actor.role === "agency_admin" || actor.brandIds.includes(brandId);
}
