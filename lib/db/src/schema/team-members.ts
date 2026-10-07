import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const teamMembersTable = pgTable("team_members", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  clerkUserId: text("clerk_user_id"),
  name: text("name"),
  email: text("email").notNull(),
  role: text("role").$type<"agency_admin" | "client" | "team_member">().notNull(),
  brandIds: integer("brand_ids").array().notNull().default([]),
  status: text("status").$type<"active" | "invited">().notNull().default("invited"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("team_members_email_unique").on(table.email),
  uniqueIndex("team_members_clerk_user_id_unique").on(table.clerkUserId),
]);

export const insertTeamMemberSchema = createInsertSchema(teamMembersTable);
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembersTable.$inferSelect;
