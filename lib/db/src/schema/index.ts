import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── businesses ────────────────────────────────────────────────────────────────

export const businesses = pgTable("businesses", {
  id:          text("id").primaryKey(),
  bizName:     text("biz_name").notNull(),
  bizType:     text("biz_type").notNull(),
  phone:       text("phone"),
  services:    text("services"),
  location:    text("location"),
  howToOrder:  text("how_to_order"),
  instagram:   text("instagram"),
  personality: text("personality"),
  welcomeMsg:  text("welcome_msg"),
  accentColor: text("accent_color"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export const insertBusinessSchema = createInsertSchema(businesses).omit({ createdAt: true });
export const selectBusinessSchema = createSelectSchema(businesses);
export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businesses.$inferSelect;

// ── leads ─────────────────────────────────────────────────────────────────────

export const leads = pgTable("leads", {
  id:                 text("id").primaryKey(),
  businessId:         text("business_id").notNull().references(() => businesses.id),
  timestamp:          timestamp("timestamp").notNull(),
  customerName:       text("customer_name"),
  servicesInterested: text("services_interested").array().notNull().default([]),
  bookingIntent:      text("booking_intent").notNull().default("low"),
  questionsAsked:     text("questions_asked").array().notNull().default([]),
  conversationLength: integer("conversation_length").notNull().default(0),
  summaryText:        text("summary_text").notNull().default(""),
});

export const insertLeadSchema = createInsertSchema(leads);
export const selectLeadSchema = createSelectSchema(leads);
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;
