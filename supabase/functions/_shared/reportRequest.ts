// Sprint 2.6 — Canonical request parser for V2 report edge functions.
import { z } from "https://esm.sh/zod@3.23.8";

const dateRangeSchema = z
  .object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  })
  .partial()
  .optional();

const teamVisibilitySchema = z
  .object({
    enabled: z.boolean().default(false),
    visibleUserIds: z.array(z.string().uuid()).default([]),
  })
  .partial()
  .optional();

export const reportFiltersSchema = z
  .object({
    dateRange: dateRangeSchema,
    pipelineIds: z.array(z.string().uuid()).optional(),
    ownerUserIds: z.array(z.string().uuid()).optional(),
    qualifiedByUserIds: z.array(z.string().uuid()).optional(),
    originNames: z.array(z.string()).optional(),
    stageIds: z.array(z.string().uuid()).optional(),
    status: z.array(z.string()).optional(),
    lossReasonIds: z.array(z.string().uuid()).optional(),
    teamVisibility: teamVisibilitySchema,
  })
  .partial()
  .default({});

export const reportOptionsSchema = z
  .object({
    limit: z.number().int().min(1).max(1000).default(100),
    offset: z.number().int().min(0).default(0),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    includeMeta: z.boolean().default(true),
    includeDebug: z.boolean().default(false),
  })
  .partial()
  .default({});

export const reportRequestSchema = z.object({
  organizationId: z.string().uuid(),
  filters: reportFiltersSchema.optional(),
  options: reportOptionsSchema.optional(),
});

export type ReportFilters = z.infer<typeof reportFiltersSchema>;
export type ReportOptions = z.infer<typeof reportOptionsSchema>;
export type ReportRequest = z.infer<typeof reportRequestSchema>;

export interface ParsedRequest {
  ok: true;
  value: {
    organizationId: string;
    filters: ReportFilters;
    options: Required<ReportOptions>;
    raw: ReportRequest;
  };
}
export interface ParsedRequestError {
  ok: false;
  error: string;
}

const DEFAULT_OPTIONS: Required<ReportOptions> = {
  limit: 100,
  offset: 0,
  sortBy: undefined as unknown as string,
  sortOrder: "desc",
  includeMeta: true,
  includeDebug: false,
};

export async function parseReportRequest(
  req: Request,
): Promise<ParsedRequest | ParsedRequestError> {
  let body: unknown = {};
  try {
    if (req.method !== "GET") {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    }
  } catch (_) {
    return { ok: false, error: "Invalid JSON body" };
  }

  const parsed = reportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }

  const filters = (parsed.data.filters ?? {}) as ReportFilters;
  const options = {
    ...DEFAULT_OPTIONS,
    ...(parsed.data.options ?? {}),
  } as Required<ReportOptions>;

  return {
    ok: true,
    value: {
      organizationId: parsed.data.organizationId,
      filters,
      options,
      raw: parsed.data,
    },
  };
}
