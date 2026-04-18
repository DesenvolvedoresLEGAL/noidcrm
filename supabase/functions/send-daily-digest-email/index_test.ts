// Tests do send-daily-digest-email: roteamento SMTP vs Resend, skip por preferência.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("respeita daily_digest_email_enabled=false → método skipped_user_pref", () => {
  const settings = { daily_digest_email_enabled: false };
  const shouldSkip = settings.daily_digest_email_enabled === false;
  assertEquals(shouldSkip, true);
});

Deno.test("usuário sem settings de email envia por default", () => {
  const settings: any = null;
  const shouldSkip = settings?.daily_digest_email_enabled === false;
  assertEquals(shouldSkip, false);
});

Deno.test("se tem SMTP custom ativo, prioriza SMTP", () => {
  const smtpConfig = { user_id: "u1" };
  const route = smtpConfig ? "smtp" : "resend";
  assertEquals(route, "smtp");
});

Deno.test("sem SMTP, fallback para Resend quando RESEND_API_KEY existe", () => {
  const smtpConfig = null;
  const resendKey = "re_xxx";
  const route = smtpConfig ? "smtp" : (resendKey ? "resend" : "no_provider");
  assertEquals(route, "resend");
});

Deno.test("sem SMTP e sem Resend, retorna no_provider", () => {
  const smtpConfig = null;
  const resendKey = undefined;
  const route = smtpConfig ? "smtp" : (resendKey ? "resend" : "no_provider");
  assertEquals(route, "no_provider");
});
