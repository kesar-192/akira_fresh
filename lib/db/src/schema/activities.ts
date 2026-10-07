import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { brandsTable } from "./brands";

export const activitiesTable = pgTable("activities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  brandId: integer("brand_id").references(() => brandsTable.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  target: text("target").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activitiesTable);
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;
