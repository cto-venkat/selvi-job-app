import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  boolean,
  jsonb,
  date,
} from "drizzle-orm/pg-core";

// --- Multi-tenant ---

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").unique(), // kept for DB compat, unused by app
  name: text("name"),
  email: text("email"),
  slug: text("slug"),
  plan: text("plan").default("free"), // kept for DB compat, unused by app
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// --- Core tables ---

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  title: text("title"),
  company: text("company"),
  location: text("location"),
  url: text("url"),
  source: text("source"),
  description: text("description"),
  tier: text("tier"),
  compositeScore: numeric("composite_score"),
  status: text("status"),
  jobType: text("job_type"),
  salaryMin: numeric("salary_min"),
  salaryMax: numeric("salary_max"),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow(),
  readyToApply: boolean("ready_to_apply"),
  cvPackageStatus: text("cv_package_status"),
});

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  jobId: uuid("job_id"),
  companyName: text("company_name"),
  jobTitle: text("job_title"),
  pipelineTrack: text("pipeline_track"),
  currentState: text("current_state"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  followUpCount: integer("follow_up_count").default(0),
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
  interviewCount: integer("interview_count").default(0),
  discoverySource: text("discovery_source"),
  // Note: is_active is a GENERATED ALWAYS column in Postgres - excluded from Drizzle to avoid query failures
});

export const applicationNotes = pgTable("application_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  applicationId: uuid("application_id"),
  text: text("text"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const interviews = pgTable("interviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  companyName: text("company_name"),
  roleTitle: text("role_title"),
  interviewTrack: text("interview_track"),
  interviewFormat: text("interview_format"),
  interviewDate: date("interview_date"),
  interviewStartTime: text("interview_start_time"),
  status: text("status"),
  locationType: text("location_type"),
  videoLink: text("video_link"),
  physicalAddress: text("physical_address"),
});

export const prepBriefs = pgTable("prep_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  interviewId: uuid("interview_id"),
  fullBriefText: text("full_brief_text"),
  overallQualityScore: numeric("overall_quality_score"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
});

export const cvPackages = pgTable("cv_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  jobId: uuid("job_id"),
  jobTitle: text("job_title"),
  company: text("company"),
  cvType: text("cv_type"),
  matchPercentage: integer("match_percentage"),
  status: text("status"),
  highlights: jsonb("highlights"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const pipelineMetrics = pgTable("pipeline_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  metricName: text("metric_name"),
  metricValue: numeric("metric_value"),
  dimensions: jsonb("dimensions"),
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  periodType: text("period_type"),
});

export const emails = pgTable("emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  subject: text("subject"),
  fromEmail: text("from_email"),
  fromName: text("from_name"),
  date: timestamp("date", { withTimezone: true }),
  status: text("status"),
  isJobRelated: boolean("is_job_related"),
});

export const emailClassifications = pgTable("email_classifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  emailId: uuid("email_id"),
  classification: text("classification"),
  confidence: numeric("confidence"),
  isUrgent: boolean("is_urgent"),
});

export const contentCalendar = pgTable("content_calendar", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  topicTitle: text("topic_title"),
  contentPillar: text("content_pillar"),
  draftText: text("draft_text"),
  status: text("status"),
  suggestedPostDay: text("suggested_post_day"),
});

export const notificationQueue = pgTable("notification_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id"),
  notificationType: text("notification_type"),
  priority: text("priority"),
  subject: text("subject"),
  sent: boolean("sent").default(false),
});

// Types
export type Tenant = typeof tenants.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type ApplicationNote = typeof applicationNotes.$inferSelect;
export type Interview = typeof interviews.$inferSelect;
export type PrepBrief = typeof prepBriefs.$inferSelect;
export type CvPackage = typeof cvPackages.$inferSelect;
export type PipelineMetric = typeof pipelineMetrics.$inferSelect;
export type Email = typeof emails.$inferSelect;
export type EmailClassification = typeof emailClassifications.$inferSelect;
export type ContentCalendarEntry = typeof contentCalendar.$inferSelect;
export type NotificationQueueEntry = typeof notificationQueue.$inferSelect;
