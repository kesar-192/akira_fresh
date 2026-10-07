import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const brandsTable = pgTable("brands", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  industry: text("industry"),
  description: text("description"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#7458F5"),
  secondaryColor: text("secondary_color").notNull().default("#EAE5FF"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBrandSchema = createInsertSchema(brandsTable);
export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brandsTable.$inferSelect;
