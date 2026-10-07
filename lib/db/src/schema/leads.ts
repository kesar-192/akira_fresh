import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { adsTable } from "./ads";
import { brandsTable } from "./brands";

export const leadsTable = pgTable("leads", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  brandId: integer("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
  adId: integer("ad_id").notNull().references(() => adsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  consent: boolean("consent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("leads_brand_created_idx").on(table.brandId, table.createdAt)]);

export const insertLeadSchema = createInsertSchema(leadsTable);
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
