import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { integer, jsonb, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { adsTable } from "./ads";

export const adEventsTable = pgTable("ad_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  adId: integer("ad_id").notNull().references(() => adsTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").$type<"view" | "interaction" | "click" | "completion" | "lead_submit">().notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("ad_events_ad_created_idx").on(table.adId, table.createdAt)]);

export const insertAdEventSchema = createInsertSchema(adEventsTable);
export type InsertAdEvent = z.infer<typeof insertAdEventSchema>;
export type AdEvent = typeof adEventsTable.$inferSelect;
