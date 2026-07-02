import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Sparkles, Loader2, Star, Mail, Phone, Linkedin, Copy, CheckCircle2, AlertCircle, PackageCheck, MessageCircle, PhoneCall, ChevronDown, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useEnrichedContacts } from "@/hooks/useEnrichedContacts";
import { useSyncEnrichedContacts } from "@/hooks/useSyncEnrichedContacts";
import { useRevealContact } from "@/hooks/intelligence/useRevealContact";
import { ApolloConfirmModal } from "./enrichment/ApolloConfirmModal";
import { RevealConfirmModal } from "./enrichment/RevealConfirmModal";
import { ContactsQualityPanel } from "./enrichment/ContactsQualityPanel";
import { MergedContactsAccordion } from "./enrichment/MergedContactsAccordion";
import { HiddenRecommendationBadges } from "./HiddenRecommendationBadges";
import { useApolloRaw } from "@/hooks/intelligence/useApolloQueryLogs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listMergedContacts } from "@/services/enrichment/apolloService";
import type { RevealDataType } from "@/services/intelligence/apolloInvisible";
import { cn } from "@/lib/utils";

interface ProspectContactsTabProps {
  prospectId: string;
  decisionMakerFound?: boolean | null;
  enrichmentStatus?: string | null;
  contactScore?: number | null;
  matchedAccountId?: string | null;
}

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copiado`);
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const tone =
    score >= 70 ? "bg-green-500/10 text-green-600 border-green-500/20" :
    score >= 40 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
    "bg-red-500/10 text-red-600 border-red-500/20";
  return <Badge variant="outline" className={cn("text-xs font-bold", tone)}>{score}</Badge>;
}

function SeniorityBadge({ s }: { s: string | null }) {
  if (!s) return null;
  const map: Record<string, { label: string; cls: string }> = {
    c_level: { label: "C-Level", cls: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
    vp: { label: "VP", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    director: { label: "Diretor", cls: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
    manager: { label: "Gerente", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    ic: { label: "IC", cls: "bg-muted text-muted-foreground" },
  };
  const cfg = map[s] ?? { label: s, cls: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={cn("text-[10px]", cfg.cls)}>{cfg.label}</Badge>;
}

export function ProspectContactsTab({
  prospectId,
  decisionMakerFound,
  enrichmentStatus,
  contactScore,
  matchedAccountId,
}: ProspectContactsTabProps) {
  const { data: contacts = [], isLoading, enrich, setPrimary } = useEnrichedContacts(prospectId);
  const { data: mergedContacts = [] } = useQuery({
    queryKey: ["merged-contacts", prospectId],
    queryFn: () => listMergedContacts(prospectId),
    enabled: !!prospectId,
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const sync = useSyncEnrichedContacts();
  const reveal = useRevealContact();
  const [revealingKey, setRevealingKey] = useState<string | null>(null);
  const [confirmReveal, setConfirmReveal] = useState<{
    contactId: string;
    contactName: string | null;
    dataType: RevealDataType;
    emailStatus: string | null;
    phoneStatus: string | null;
  } | null>(null);

  const runReveal = async (contactId: string, dataType: RevealDataType, name: string | null) => {
    const key = `${contactId}:${dataType}`;
    setRevealingKey(key);
    try {
      await reveal.mutateAsync({
        contactId,
        prospectId,
        requestedDataType: dataType,
        contactName: name ?? undefined,
        source: 'manual',
      });
    } finally {
      setRevealingKey(null);
    }
  };

  const qc = useQueryClient();
  const markPhoneInvalid = async (contactId: string) => {
    const reason = window.prompt("Motivo (opcional):", "invalido_pelo_sdr");
    if (reason === null) return;
    const { data, error } = await (supabase.rpc as any)("mark_contact_phone_invalid", {
      p_contact_id: contactId,
      p_reason: reason || null,
    });
    if (error || (data && data.success === false)) {
      toast.error("Falha ao marcar telefone como inválido");
      return;
    }
    toast.success("Telefone marcado como inválido");
    qc.invalidateQueries({ queryKey: ["enriched-contacts", prospectId] });
  };

  const digitsOnly = (p: string) => p.replace(/\D/g, "");
  const openWhatsApp = (phone: string) => {
    window.open(`https://wa.me/${digitsOnly(phone)}`, "_blank", "noopener");
  };
  const callPhone = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  // Default selection: primary + decisores (c_level/vp/director/manager) com email
  useEffect(() => {
    if (contacts.length === 0) return;
    setSelected((prev) => {
      if (prev.size > 0) return prev;
      const next = new Set<string>();
      for (const c of contacts) {
        const isDM = c.is_primary || ["c_level", "vp", "director", "manager"].includes(c.seniority ?? "");
        if (isDM && (c.email || c.phone)) next.add(c.id);
      }
      return next;
    });
  }, [contacts]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedWithData = useMemo(
    () => contacts.filter((c) => selected.has(c.id) && (c.email || c.phone || c.full_name)),
    [contacts, selected],
  );

  const handleConfirm = async (customTitles?: string[]) => {
    try {
      const res = await enrich.mutateAsync({ customTitles });
      const ep = res.endpoint_used ? ` (via ${res.endpoint_used})` : "";
      const titlesNote = customTitles && customTitles.length > 0
        ? ` · cargos: ${customTitles.slice(0, 3).join(", ")}${customTitles.length > 3 ? "…" : ""}`
        : "";
      if (res.status === "skipped") {
        toast.info(`Apollo pulou: ${res.reason ?? "não elegível"}`);
      } else if (res.status === "failed") {
        const inaccessible = res.attempts?.every((a) => a.inaccessible);
        toast.error(
          inaccessible
            ? "Sua chave Apollo não tem acesso a People/Contacts Search. Habilite no plano da Apollo."
            : `Apollo falhou: ${res.reason ?? "erro desconhecido"}`,
          { duration: 8000 },
        );
      } else if ((res.contacts_found ?? 0) > 0) {
        toast.success(`${res.contacts_found} contato(s) encontrado(s) (${res.decision_makers_found ?? 0} decisor(es))${ep}${titlesNote}`);
      } else {
        toast.warning(`Nenhum contato encontrado${ep}${titlesNote}. Tente outros cargos ou domínio.`, { duration: 6000 });
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao chamar Apollo");
    }
  };

  const handleImport = () => {
    if (!matchedAccountId) {
      toast.error("Importe o prospect no CRM primeiro (aba Detalhes → Importar no CRM)");
      return;
    }
    if (selectedWithData.length === 0) {
      toast.info("Selecione ao menos um contato com email ou telefone");
      return;
    }
    sync.mutate({
      prospectId,
      accountId: matchedAccountId,
      contactIds: selectedWithData.map((c) => c.id),
    });
  };

  return (
    <div className="space-y-4 py-4 pb-24 relative">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {decisionMakerFound && (
            <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              🎯 Decisor encontrado
            </Badge>
          )}
          {contactScore != null && (
            <Badge variant="outline">Top score: <span className="ml-1 font-bold">{contactScore}</span></Badge>
          )}
          {enrichmentStatus && (
            <Badge variant="secondary" className="text-[10px]">{enrichmentStatus}</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirmOpen(true)}
          disabled={enrich.isPending}
          className="gap-1.5"
        >
          {enrich.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Enriquecer (Apollo)
        </Button>
      </div>

      <ApolloConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        prospectId={prospectId}
        onConfirm={handleConfirm}
        isRunning={enrich.isPending}
      />

      {confirmReveal && (
        <RevealConfirmModal
          open={!!confirmReveal}
          onOpenChange={(v) => !v && setConfirmReveal(null)}
          contactName={confirmReveal.contactName}
          requestedDataType={confirmReveal.dataType}
          emailStatus={confirmReveal.emailStatus}
          phoneStatus={confirmReveal.phoneStatus}
          isRunning={reveal.isPending}
          onConfirm={async () => {
            await runReveal(confirmReveal.contactId, confirmReveal.dataType, confirmReveal.contactName);
          }}
        />
      )}

      {isLoading && <div className="text-sm text-muted-foreground py-4 text-center">Carregando contatos…</div>}

      {!isLoading && contacts.length > 0 && (
        <ContactsQualityPanel contacts={contacts} mergedCount={mergedContacts.length} />
      )}

      {!isLoading && contacts.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
          <AlertCircle className="h-5 w-5 mx-auto mb-2 opacity-50" />
          Nenhum decisor mapeado ainda. Use <strong>Enriquecer (Apollo)</strong> para buscar contatos.
          <div className="text-xs mt-2 opacity-75">
            Modo teste Kairós: enriquecimento manual liberado para qualquer qualidade.
          </div>
        </Card>
      )}

      {!matchedAccountId && contacts.length > 0 && (
        <Card className="p-3 text-xs text-amber-700 bg-amber-500/5 border-amber-500/30 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            Para importar contatos no CRM, primeiro importe o prospect (aba <strong>Detalhes</strong> → botão <strong>Importar no CRM</strong>).
            Os decisores principais serão sincronizados automaticamente.
          </div>
        </Card>
      )}

      {contacts.map((c) => {
        const isSelected = selected.has(c.id);
        const hasData = !!(c.email || c.phone);
        return (
          <Card key={c.id} className={cn("p-3 space-y-2", c.is_primary && "ring-1 ring-primary/40 bg-primary/5", isSelected && "border-primary/40")}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <Checkbox
                  checked={isSelected}
                  disabled={!hasData && !c.full_name}
                  onCheckedChange={() => toggle(c.id)}
                  className="mt-0.5"
                  aria-label={`Selecionar ${c.full_name ?? "contato"}`}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm truncate">{c.full_name || "—"}</span>
                    {c.is_primary && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                    <SeniorityBadge s={c.seniority} />
                  </div>
                  {c.role_title && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{c.role_title}</div>
                  )}
                </div>
              </div>
              <ConfidenceBadge score={c.confidence_score} />
            </div>

            <div className="space-y-1 text-xs pl-6">
              {c.email ? (
                <button
                  onClick={() => copy(c.email!, "Email")}
                  className="flex items-center gap-1.5 w-full hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 group"
                >
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate font-mono">{c.email}</span>
                  {c.email_status === "verified" && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                  <Copy className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-50" />
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-muted-foreground/60 italic">
                  <Mail className="h-3 w-3" /> sem e-mail
                </div>
              )}
              {c.phone && c.phone_revealed && (c.phone_validation_status !== "invalid") ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 w-full hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 group text-left">
                      {c.is_whatsapp_ready ? (
                        <MessageCircle className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Phone className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="font-mono">{c.phone}</span>
                      <ChevronDown className="h-3 w-3 ml-auto opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground leading-tight">
                      <div className="font-mono text-foreground text-xs mb-1">{c.phone}</div>
                      <div>Origem: {c.phone_source ?? "apollo"}</div>
                      <div>Tipo: {c.phone_match_quality ?? c.phone_type ?? "—"}</div>
                      <div>Confiança: {c.phone_confidence ?? 0}%</div>
                      {c.phone_verified_at && (
                        <div>Validado: {new Date(c.phone_verified_at).toLocaleDateString("pt-BR")}</div>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => copy(c.phone!, "Telefone")}>
                      <Copy className="h-3.5 w-3.5 mr-2" /> Copiar número
                    </DropdownMenuItem>
                    {c.is_whatsapp_ready && (
                      <DropdownMenuItem onClick={() => openWhatsApp(c.phone!)}>
                        <MessageCircle className="h-3.5 w-3.5 mr-2 text-emerald-600" /> Abrir WhatsApp
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => callPhone(c.phone!)}>
                      <PhoneCall className="h-3.5 w-3.5 mr-2" /> Ligar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onClick={() => markPhoneInvalid(c.id)}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-2" /> Marcar como inválido
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-1.5 text-muted-foreground/60 italic">
                  <Phone className="h-3 w-3" /> sem telefone
                </div>
              )}
              {c.linkedin_url && (
                <a
                  href={c.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-primary px-1 py-0.5 -mx-1"
                >
                  <Linkedin className="h-3 w-3" />
                  <span className="truncate">LinkedIn</span>
                </a>
              )}
            </div>

            {(() => {
              const phoneStatus = c.phone_reveal_status ?? (c.phone ? "revealed" : "not_requested");
              const emailStatus = c.email_reveal_status ?? (c.email ? "revealed" : "not_requested");
              const phoneSource: string | null = (c as any).phone_source_type ?? null;
              const phoneRevealed = !!(c.phone_revealed ?? c.phone);
              const emailRevealed = !!(c.email_revealed ?? c.email);
              const phoneBlocked = phoneStatus === "not_found" || phoneStatus === "rejected_company_phone";
              const emailBlocked = emailStatus === "not_found";

              // KAI.15.2: label prioriza phone_match_quality; fallback para phone_source_type
              const quality: string | null = (c as any).phone_match_quality ?? phoneSource;
              const isWA = !!(c as any).is_whatsapp_ready;
              const phoneRevealedLabel =
                isWA
                  ? "WhatsApp pronto"
                  : quality === "person_mobile"
                    ? "Celular revelado"
                    : quality === "person_direct"
                      ? "Direto revelado"
                      : quality === "person_whatsapp"
                        ? "WhatsApp pronto"
                        : "Telefone revelado";
              const phoneNotFoundLabel =
                quality === "company_main" || quality === "company_reception"
                  ? "Telefone da empresa rejeitado"
                  : "Telefone não encontrado";

              const phoneBadge: Record<string, { label: string; cls: string }> = {
                not_requested: { label: "Telefone: não solicitado", cls: "bg-muted text-muted-foreground" },
                requested: { label: "Buscando telefone...", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
                awaiting: { label: "Buscando telefone...", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
                pending: { label: "Buscando telefone...", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
                revealed: { label: phoneRevealedLabel, cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
                not_found: { label: phoneNotFoundLabel, cls: "bg-red-500/10 text-red-600 border-red-500/30" },
                rejected_company_phone: { label: "Telefone da empresa rejeitado", cls: "bg-red-500/10 text-red-600 border-red-500/30" },
                failed: { label: "Falha ao revelar", cls: "bg-red-500/10 text-red-600 border-red-500/30" },
                skipped: { label: "Já revelado / ignorado", cls: "bg-muted text-muted-foreground" },
              };
              const emailBadge: Record<string, { label: string; cls: string }> = {
                not_requested: { label: "E-mail: não solicitado", cls: "bg-muted text-muted-foreground" },
                requested: { label: "E-mail: aguardando", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
                revealed: { label: c.email_status === "verified" ? "E-mail verificado" : "E-mail revelado", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
                not_found: { label: "E-mail não encontrado", cls: "bg-red-500/10 text-red-600 border-red-500/30" },
                failed: { label: "E-mail falhou", cls: "bg-red-500/10 text-red-600 border-red-500/30" },
                skipped: { label: "E-mail: pulado", cls: "bg-muted text-muted-foreground" },
              };
              const pCfg = phoneBadge[phoneStatus] ?? phoneBadge.not_requested;
              const eCfg = emailBadge[emailStatus] ?? emailBadge.not_requested;

              const openConfirm = (dt: RevealDataType) =>
                setConfirmReveal({
                  contactId: c.id,
                  contactName: c.full_name,
                  dataType: dt,
                  emailStatus,
                  phoneStatus,
                });

              const phoneKey = `${c.id}:phone`;
              const emailKey = `${c.id}:email`;
              const bothKey = `${c.id}:both`;

              return (
                <div className="pl-6 pt-1 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className={cn("text-[10px]", pCfg.cls)}>{pCfg.label}</Badge>
                    <Badge variant="outline" className={cn("text-[10px]", eCfg.cls)}>{eCfg.label}</Badge>
                  </div>
                  {(!phoneRevealed || !emailRevealed) && (
                    <div className="grid grid-cols-3 gap-1.5">
                      <Button
                        size="sm" variant="outline"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => openConfirm("phone")}
                        disabled={phoneRevealed || phoneBlocked || reveal.isPending}
                      >
                        {revealingKey === phoneKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Phone className="h-3 w-3" />}
                        Telefone
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => openConfirm("email")}
                        disabled={emailRevealed || emailBlocked || reveal.isPending}
                      >
                        {revealingKey === emailKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                        E-mail
                      </Button>
                      <Button
                        size="sm" variant="default"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => openConfirm("both")}
                        disabled={(phoneRevealed && emailRevealed) || reveal.isPending}
                      >
                        {revealingKey === bothKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        Ambos
                      </Button>
                    </div>
                  )}
                </div>
              );
            })()}

            {!c.is_primary && (
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] gap-1"
                  onClick={() => setPrimary.mutate(c.id)}
                  disabled={setPrimary.isPending}
                >
                  <Star className="h-3 w-3" /> Marcar principal
                </Button>
              </div>
            )}
          </Card>
        );
      })}

      {!isLoading && mergedContacts.length > 0 && (
        <MergedContactsAccordion prospectId={prospectId} />
      )}

      {contacts.length > 0 && (
        <div className="sticky bottom-0 left-0 right-0 -mx-6 px-6 py-3 bg-background/95 backdrop-blur border-t flex items-center justify-between gap-3 z-10">
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedWithData.length}</span> selecionado{selectedWithData.length === 1 ? "" : "s"}
            {selected.size !== selectedWithData.length && (
              <span className="ml-1 opacity-70">({selected.size - selectedWithData.length} sem dados)</span>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={sync.isPending || selectedWithData.length === 0 || !matchedAccountId}
            className="gap-1.5"
          >
            {sync.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="h-3.5 w-3.5" />}
            Importar {selectedWithData.length > 0 ? selectedWithData.length : ""} no CRM
          </Button>
        </div>
      )}
    </div>
  );
}
