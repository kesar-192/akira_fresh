import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { brandsTable } from "./brands";

export const adsTable = pgTable("ads", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  brandId: integer("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").$type<"poll" | "quiz" | "spin_wheel" | "carousel" | "lead_form" | "swipe_cards">().notNull(),
  status: text("status").$type<"draft" | "published" | "archived">().notNull().default("draft"),
  slug: text("slug").unique(),
  headline: text("headline").notNull(),
  body: text("body").notNull().default(""),
  imageUrl: text("image_url"),
  ctaLabel: text("cta_label").notNull().default("Learn more"),
  accentColor: text("accent_color").notNull().default("#7458F5"),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  impressions: integer("impressions").notNull().default(0),
  interactions: integer("interactions").notNull().default(0),
  leads: integer("leads").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAdSchema = createInsertSchema(adsTable);
export type InsertAd = z.infer<typeof insertAdSchema>;
export type Ad = typeof adsTable.$inferSelect;
