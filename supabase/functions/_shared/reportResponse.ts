// Sprint 2.6 — Standard response envelope for V2 report edge functions.
import type { ReportFilters } from "./reportRequest.ts";
import type { ReportConfidence } from "./reportConfidence.ts";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export interface ReportMeta {
  reportKey: string;
  organizationId: string;
  generatedAt: string;
  filtersApplied: ReportFilters | null;
  rowCount: number;
  confidence: ReportConfidence | null;
  status: "ok" | "unavailable";
  debug?: Record<string, unknown>;
}

export interface ReportSuccess<T> {
  success: true;
  data: T;
  meta: ReportMeta;
  error: null;
}

export interface ReportError {
  success: false;
  data: null;
  meta: ReportMeta;
  error: { code: string; message: string };
}

export interface OkArgs<T> {
  reportKey: string;
  organizationId: string;
  data: T;
  filtersApplied?: ReportFilters | null;
  confidence?: ReportConfidence | null;
  rowCount?: number;
  debug?: Record<string, unknown>;
  status?: number;
}

export function okResponse<T>(args: OkArgs<T>): Response {
  const rowCount =
    typeof args.rowCount === "number"
      ? args.rowCount
      : Array.isArray(args.data)
        ? (args.data as unknown[]).length
        : args.data
          ? 1
          : 0;

  const body: ReportSuccess<T> = {
    success: true,
    data: args.data,
    meta: {
      reportKey: args.reportKey,
      organizationId: args.organizationId,
      generatedAt: new Date().toISOString(),
      filtersApplied: args.filtersApplied ?? null,
      rowCount,
      confidence: args.confidence ?? null,
      status: "ok",
      debug: args.debug,
    },
    error: null,
  };

  return new Response(JSON.stringify(body), {
    status: args.status ?? 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export interface ErrArgs {
  reportKey: string;
  organizationId?: string;
  code: string;
  message: string;
  status: number;
  filtersApplied?: ReportFilters | null;
  debug?: Record<string, unknown>;
}

export function errResponse(args: ErrArgs): Response {
  const body: ReportError = {
    success: false,
    data: null,
    meta: {
      reportKey: args.reportKey,
      organizationId: args.organizationId ?? "",
      generatedAt: new Date().toISOString(),
      filtersApplied: args.filtersApplied ?? null,
      rowCount: 0,
      confidence: null,
      status: "unavailable",
      debug: args.debug,
    },
    error: { code: args.code, message: args.message },
  };

  return new Response(JSON.stringify(body), {
    status: args.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function preflight(): Response {
  return new Response("ok", { headers: corsHeaders });
}
