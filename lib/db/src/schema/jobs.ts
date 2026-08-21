import { createInsertSchema } from "drizzle-zod";
import { date, integer, numeric, pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  customerAddress: text("customer_address"),
  state: text("state"),
  area: text("area"),
  installationDate: date("installation_date", { mode: "string" }),
  outletName: text("outlet_name"),
  agentName: text("agent_name"),
  dealCode: text("deal_code"),
  shopPickName: text("shop_pick_name"),
  shopPickLocation: text("shop_pick_location"),
  deviceNumber: text("device_number"),
  deviceImei: text("device_imei"),
  deviceType: text("device_type"),
  jobSource: text("job_source").default("WRKMAN"),
  dateReceived: date("date_received", { mode: "string" }),
  assignedDate: date("assigned_date", { mode: "string" }),
  scheduledDate: date("scheduled_date", { mode: "string" }),
  priority: text("priority").notNull().default("NORMAL"),
  status: text("status").notNull().default("NEW"),
  notes: text("notes"),
  internalNotes: text("internal_notes"),
  contactStatus: text("contact_status"),
  lastContactDate: timestamp("last_contact_date", { withTimezone: true }),
  nextFollowUpDate: date("next_follow_up_date", { mode: "string" }),
  postponementDate: date("postponement_date", { mode: "string" }),
  postponementReason: text("postponement_reason"),
  completionDate: date("completion_date", { mode: "string" }),
  completionTime: text("completion_time"),
  transportCost: numeric("transport_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  otherExpenses: numeric("other_expenses", { precision: 12, scale: 2 }).notNull().default("0"),
  expenseDescription: text("expense_description"),
  totalExpenses: numeric("total_expenses", { precision: 12, scale: 2 }).notNull().default("0"),
  customerConfirmation: text("customer_confirmation"),
  installationNotes: text("installation_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const contactsTable = pgTable("job_contacts", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  time: text("time").notNull(),
  method: text("method").notNull(),
  result: text("result").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("Israel"),
  phone: text("phone").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  currency: text("currency").notNull().default("NGN"),
  defaultStatus: text("default_status").notNull().default("NEW"),
  defaultPriority: text("default_priority").notNull().default("NORMAL"),
  smsTemplates: jsonb("sms_templates").$type<Record<string, string>>().notNull().default({}),
  whatsappTemplates: jsonb("whatsapp_templates").$type<Record<string, string>>().notNull().default({}),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContactSchema = createInsertSchema(contactsTable).omit({ id: true, createdAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
export type Contact = typeof contactsTable.$inferSelect;