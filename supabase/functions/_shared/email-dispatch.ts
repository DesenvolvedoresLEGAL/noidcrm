// Shared helper for dispatching agent emails via the internal SMTP sender.
// Single contract used by approve-email-agent-action, execute-email-agent-run,
// and any future agent that needs assisted/approved email delivery.
//
// Why: prevent payload drift between callers (the root cause of the
// "approved but not sent" bug). All callers MUST go through this helper.

export interface AgentEmailDispatchInput {
  supabaseUrl: string;
  internalSecret: string;
  senderUserId: string;             // user_id whose SMTP config will be used
  recipientEmail: string;           // single recipient (agent emails are 1:1)
  subject: string;
  bodyHtml: string;
  bodyText?: string | null;
  // Optional context — when opportunityId is provided, the email is logged
  // into opportunity_emails with tracking pixel/link rewriting so it shows
  // up in the opportunity Emails tab with open/click analytics.
  opportunityId?: string | null;
  contactId?: string | null;
  organizationId?: string | null;
}

export interface AgentEmailDispatchResult {
  success: boolean;
  messageId?: string;
  errorMessage?: string;
  errorCode?: string;               // e.g. "no_smtp", "smtp_auth", "http_403"
  httpStatus?: number;
  rawResponse?: unknown;
}

/**
 * Dispatch an agent email through the internal SMTP sender.
 * Always uses the sender_user_id's SMTP config — never falls back silently.
 */
export async function dispatchAgentEmail(
  input: AgentEmailDispatchInput,
): Promise<AgentEmailDispatchResult> {
  const { supabaseUrl, internalSecret, senderUserId, recipientEmail, subject, bodyHtml, bodyText, opportunityId, contactId, organizationId } = input;

  if (!internalSecret) {
    return { success: false, errorCode: "missing_internal_secret", errorMessage: "INTERNAL_WORKFLOW_SECRET not configured on server" };
  }
  if (!senderUserId) {
    return { success: false, errorCode: "missing_sender", errorMessage: "sender_user_id not set on email message" };
  }
  if (!recipientEmail) {
    return { success: false, errorCode: "missing_recipient", errorMessage: "recipient_email not set on email message" };
  }
  if (!subject || (!bodyHtml && !bodyText)) {
    return { success: false, errorCode: "missing_content", errorMessage: "subject and body required" };
  }

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/send-smtp-email-internal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret,
      },
      body: JSON.stringify({
        user_id: senderUserId,
        to_emails: [recipientEmail],
        subject,
        html_body: bodyHtml || `<pre>${escapeHtml(bodyText || "")}</pre>`,
        text_body: bodyText || null,
        opportunity_id: opportunityId || null,
        contact_id: contactId || null,
        organization_id: organizationId || null,
      }),
    });

    const json = await resp.json().catch(() => ({} as any));

    if (!resp.ok) {
      return {
        success: false,
        httpStatus: resp.status,
        errorCode: (json as any)?.code || `http_${resp.status}`,
        errorMessage: (json as any)?.error || `SMTP send failed with status ${resp.status}`,
        rawResponse: json,
      };
    }

    return {
      success: true,
      messageId: (json as any)?.messageId || (json as any)?.message_id,
      rawResponse: json,
    };
  } catch (err) {
    return {
      success: false,
      errorCode: "network_error",
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
