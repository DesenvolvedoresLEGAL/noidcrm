type PaymentTermLike = Record<string, unknown>;
type ProposalLike = Record<string, unknown>;

function toDateOnly(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function termTimestamp(term: PaymentTermLike, field: "updated_at" | "created_at"): number {
  const value = term[field];
  if (typeof value !== "string") return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function firstScheduleDueDate(schedule: unknown): string | null {
  if (!Array.isArray(schedule)) return null;
  for (const item of schedule) {
    const due = toDateOnly((item as Record<string, unknown>)?.dueDate);
    if (due) return due;
  }
  return null;
}

function dueFromApprovedSchedule(proposal: ProposalLike): string | null {
  const directSchedule = firstScheduleDueDate(proposal.approved_payment_schedule);
  if (directSchedule) return directSchedule;

  const approvalSnapshot = proposal.approval_snapshot as Record<string, unknown> | null;
  return firstScheduleDueDate(approvalSnapshot?.payment_schedule);
}

function dueFromTerm(term: PaymentTermLike | null): string | null {
  if (!term) return null;

  const recurring = term.payment_type === "recurring";
  const priority = recurring
    ? ["first_payment_date", "contract_start_date", "first_installment_date", "entry_date", "second_payment_due_date"]
    : ["first_installment_date", "entry_date", "first_payment_date", "contract_start_date", "second_payment_due_date"];

  for (const field of priority) {
    const due = toDateOnly(term[field]);
    if (due) return due;
  }
  return null;
}

function sortTerms(a: PaymentTermLike, b: PaymentTermLike): number {
  const typeScore = (term: PaymentTermLike) => term.payment_type === "one_time" ? 0 : 1;
  const typeDelta = typeScore(a) - typeScore(b);
  if (typeDelta !== 0) return typeDelta;

  const updatedDelta = termTimestamp(b, "updated_at") - termTimestamp(a, "updated_at");
  if (updatedDelta !== 0) return updatedDelta;

  const createdDelta = termTimestamp(b, "created_at") - termTimestamp(a, "created_at");
  if (createdDelta !== 0) return createdDelta;

  return String(b.id ?? "").localeCompare(String(a.id ?? ""));
}

export function resolveProposalPaymentDue(
  proposal: ProposalLike,
  terms: PaymentTermLike[] | null | undefined,
): { vencimento: string | null; paymentTerms: PaymentTermLike | null; source: string } {
  const scheduleDue = dueFromApprovedSchedule(proposal);
  const sortedTerms = [...(terms ?? [])].sort(sortTerms);
  const selectedTerm = sortedTerms.find((term) => dueFromTerm(term)) ?? sortedTerms[0] ?? null;

  if (scheduleDue) {
    return { vencimento: scheduleDue, paymentTerms: selectedTerm, source: "approved_payment_schedule" };
  }

  return {
    vencimento: dueFromTerm(selectedTerm),
    paymentTerms: selectedTerm,
    source: selectedTerm ? "proposal_payment_terms" : "none",
  };
}