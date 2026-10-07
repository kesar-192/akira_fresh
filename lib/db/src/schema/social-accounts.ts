import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { brandsTable } from "./brands";

export const socialAccountsTable = pgTable("social_accounts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  brandId: integer("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
  platform: text("platform").$type<"instagram" | "facebook" | "linkedin" | "x">().notNull(),
  handle: text("handle").notNull(),
  status: text("status").$type<"connected" | "disconnected">().notNull().default("connected"),
  followers: integer("followers").notNull().default(0),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSocialAccountSchema = createInsertSchema(socialAccountsTable);
export type InsertSocialAccount = z.infer<typeof insertSocialAccountSchema>;
export type SocialAccount = typeof socialAccountsTable.$inferSelect;
