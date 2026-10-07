import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { adsTable } from "./ads";
import { brandsTable } from "./brands";

export const scheduledPostsTable = pgTable("scheduled_posts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  brandId: integer("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
  adId: integer("ad_id").references(() => adsTable.id, { onDelete: "set null" }),
  caption: text("caption").notNull().default(""),
  platforms: text("platforms").array().notNull().default([]),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: text("status").$type<"draft" | "scheduled" | "published" | "failed">().notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScheduledPostSchema = createInsertSchema(scheduledPostsTable);
export type InsertScheduledPost = z.infer<typeof insertScheduledPostSchema>;
export type ScheduledPost = typeof scheduledPostsTable.$inferSelect;
