import { Router, type IRouter } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, jobsTable, contactsTable, settingsTable } from "@workspace/db";
import {
  CreateContactBody, CreateContactParams, CreateContactResponse,
  CreateJobBody, CreateJobResponse, GetDashboardResponse, GetJobParams, GetJobResponse,
  GetReportsResponse, GetSettingsResponse, ListJobsResponse, UpdateJobBody, UpdateJobParams,
  UpdateJobResponse, UpdateSettingsBody, UpdateSettingsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const statuses = ["NEW", "CONTACTED", "CONFIRMED", "GOING", "ARRIVED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "POSTPONED", "CANCELLED", "UNREACHABLE"];
const defaultTemplates = {
  initial: "Good day, sir/ma. My name is Israel. I'm contacting you from WRKMAN. I am assigned to install your MTN ODU at your location. Please kindly let me know when you will be available for the installation. You can also reach me on WhatsApp: [MY WHATSAPP NUMBER]. Thank you.",
  noAnswer: "Good day, sir/ma. I tried reaching you concerning your MTN ODU installation assigned to me from WRKMAN. Kindly let me know when you will be available. You can also reach me on WhatsApp: [MY WHATSAPP NUMBER]. Thank you.",
  confirmation: "Good day, sir/ma. This is Israel from WRKMAN regarding your MTN ODU installation. Kindly confirm your availability for the scheduled installation.",
  onTheWay: "Good day, sir/ma. This is Israel from WRKMAN. I am currently on my way for your MTN ODU installation.",
  followUp: "Good day, sir/ma. I'm following up regarding your MTN ODU installation. Kindly let me know when you will be available.",
};
const cleanJob = (job: any, contacts: any[] = []) => ({
  ...job,
  transportCost: Number(job.transportCost ?? 0),
  otherExpenses: Number(job.otherExpenses ?? 0),
  totalExpenses: Number(job.totalExpenses ?? 0),
  contacts,
});

router.get("/jobs", async (_req, res): Promise<void> => {
  const jobs = await db.select().from(jobsTable).orderBy(asc(jobsTable.scheduledDate), asc(jobsTable.priority));
  res.json(ListJobsResponse.parse(jobs.map((job) => cleanJob(job))));
});

router.post("/jobs", async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data: any = { ...parsed.data, jobId: parsed.data.jobId || `DIGS-${Date.now()}` };
  data.totalExpenses = Number(data.transportCost ?? 0) + Number(data.otherExpenses ?? 0);
  const [job] = await db.insert(jobsTable).values(data).returning();
  res.status(201).json(CreateJobResponse.parse(cleanJob(job)));
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const parsed = GetJobParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, parsed.data.id));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  const contacts = await db.select().from(contactsTable).where(eq(contactsTable.jobId, job.id));
  res.json(GetJobResponse.parse(cleanJob(job, contacts)));
});

router.patch("/jobs/:id", async (req, res): Promise<void> => {
  const params = UpdateJobParams.safeParse({ id: Number(req.params.id) });
  const parsed = UpdateJobBody.safeParse(req.body);
  if (!params.success || !parsed.success) { res.status(400).json({ error: "Invalid job update" }); return; }
  const data: any = { ...parsed.data };
  if (data.transportCost !== undefined || data.otherExpenses !== undefined) {
    const [existing] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
    if (!existing) { res.status(404).json({ error: "Job not found" }); return; }
    data.totalExpenses = Number(data.transportCost ?? existing.transportCost ?? 0) + Number(data.otherExpenses ?? existing.otherExpenses ?? 0);
  }
  const [job] = await db.update(jobsTable).set(data).where(eq(jobsTable.id, params.data.id)).returning();
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  const contacts = await db.select().from(contactsTable).where(eq(contactsTable.jobId, job.id));
  res.json(UpdateJobResponse.parse(cleanJob(job, contacts)));
});

router.post("/jobs/:id/contacts", async (req, res): Promise<void> => {
  const params = CreateContactParams.safeParse({ id: Number(req.params.id) });
  const parsed = CreateContactBody.safeParse(req.body);
  if (!params.success || !parsed.success) { res.status(400).json({ error: "Invalid contact" }); return; }
  const now = new Date();
  const [contact] = await db.insert(contactsTable).values({
    jobId: params.data.id, date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 5),
    ...parsed.data,
  }).returning();
  await db.update(jobsTable).set({ contactStatus: parsed.data.result, lastContactDate: now }).where(eq(jobsTable.id, params.data.id));
  res.status(201).json(CreateContactResponse.parse(contact));
});

router.get("/dashboard", async (_req, res): Promise<void> => {
  const jobs = await db.select().from(jobsTable);
  const today = new Date().toISOString().slice(0, 10);
  const byStatus: Record<string, number> = {};
  for (const status of statuses) byStatus[status] = jobs.filter((job) => job.status === status).length;
  const completedToday = jobs.filter((job) => job.status === "COMPLETED" && job.completionDate === today).length;
  const todayJobs = jobs.filter((job) => job.scheduledDate === today);
  const result = { total: jobs.length, today: todayJobs.length, completedToday, remainingToday: Math.max(0, todayJobs.length - completedToday), followUps: jobs.filter((job) => job.nextFollowUpDate === today).length, awaitingResponse: jobs.filter((job) => !job.contactStatus && job.status !== "COMPLETED" && job.status !== "CANCELLED").length, byStatus };
  res.json(GetDashboardResponse.parse(result));
});

router.get("/settings", async (_req, res): Promise<void> => {
  let [settings] = await db.select().from(settingsTable).limit(1);
  if (!settings) [settings] = await db.insert(settingsTable).values({ smsTemplates: defaultTemplates, whatsappTemplates: defaultTemplates }).returning();
  res.json(GetSettingsResponse.parse(settings));
});

router.put("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  let [existing] = await db.select().from(settingsTable).limit(1);
  if (existing) [existing] = await db.update(settingsTable).set(parsed.data as any).where(eq(settingsTable.id, existing.id)).returning();
  else [existing] = await db.insert(settingsTable).values(parsed.data as any).returning();
  res.json(UpdateSettingsResponse.parse(existing));
});

router.get("/reports", async (_req, res): Promise<void> => {
  const jobs = await db.select().from(jobsTable);
  const count = (key: "status" | "agentName" | "area") => jobs.reduce<Record<string, number>>((acc, job) => { const value = key === "status" ? job.status : (job[key] || "Unassigned"); acc[value] = (acc[value] || 0) + 1; return acc; }, {});
  const result = { byStatus: count("status"), byAgent: count("agentName"), byArea: count("area"), transportExpenses: jobs.reduce((sum, job) => sum + Number(job.transportCost || 0), 0), totalExpenses: jobs.reduce((sum, job) => sum + Number(job.totalExpenses || 0), 0) };
  res.json(GetReportsResponse.parse(result));
});

export default router;