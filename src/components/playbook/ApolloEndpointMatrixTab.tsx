import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, PlayCircle, Star, Trophy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  fetchEndpointMatrix,
  fetchEndpointDiscovery,
  runEndpointMatrixReplay,
  getEndpointStrategy,
  setEndpointStrategy,
  type EndpointMatrixRow,
  type EndpointDiscoveryRow,
} from "@/services/intelligence/apolloEndpointMatrix";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const STRATEGIES = [
  { value: "auto", label: "Auto (vencedor da matrix)" },
  { value: "mixed_people", label: "mixed_people/search" },
  { value: "contacts", label: "contacts/search" },
  { value: "people", label: "people/search" },
  { value: "organization", label: "organizations/enrich" },
  { value: "graphql", label: "graphql (interno)" },
  { value: "custom", label: "custom" },
];

function Stars({ n }: { n: number | null }) {
  const stars = Math.max(0, Math.min(5, n ?? 0));
  return (
    <div className="inline-flex" aria-label={`${stars} de 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < stars ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40"}`}
        />
      ))}
    </div>
  );
}

function sourceBadge(src: string) {
  const map: Record<string, { label: string; variant: any }> = {
    web: { label: "Web (HAR)", variant: "default" },
    api: { label: "API atual", variant: "secondary" },
    replay: { label: "Replay", variant: "outline" },
    manual: { label: "Manual", variant: "outline" },
  };
  const cfg = map[src] ?? { label: src, variant: "outline" };
  return <Badge variant={cfg.variant as any}>{cfg.label}</Badge>;
}

interface Props {
  prospectId: string;
}

export function ApolloEndpointMatrixTab({ prospectId }: Props) {
  const { data: user } = useCurrentUser();
  const orgId = user?.organization?.id as string | undefined;

  const [rows, setRows] = useState<EndpointMatrixRow[]>([]);
  const [discovery, setDiscovery] = useState<EndpointDiscoveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [strategy, setStrategy] = useState<string>("auto");
  const [singleEndpoint, setSingleEndpoint] = useState<string>("mixed_people/search");

  const reload = async () => {
    setLoading(true);
    try {
      const [m, d] = await Promise.all([
        fetchEndpointMatrix(prospectId),
        fetchEndpointDiscovery(),
      ]);
      setRows(m);
      setDiscovery(d);
      if (orgId) setStrategy(await getEndpointStrategy(orgId));
    } catch (e: any) {
      toast.error("Falha ao carregar Endpoint Matrix", { description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [prospectId, orgId]);

  const latest = useMemo(() => {
    // dedupe: keep most recent per (endpoint, source)
    const map = new Map<string, EndpointMatrixRow>();
    for (const r of rows) {
      const k = `${r.endpoint}::${r.source}`;
      if (!map.has(k)) map.set(k, r);
    }
    return [...map.values()].sort((a, b) => (b.returned_contacts ?? -1) - (a.returned_contacts ?? -1));
  }, [rows]);

  const winner = latest.find((r) => r.recommended) ?? latest[0];

  const runComparative = async () => {
    setRunning(true);
    try {
      const r = await runEndpointMatrixReplay({ prospect_id: prospectId, mode: "comparative_replay" });
      toast.success(`Replay concluído. Vencedor: ${r.winner ?? "n/a"}`);
      await reload();
    } catch (e: any) {
      toast.error("Falha no replay", { description: e?.message });
    } finally { setRunning(false); }
  };

  const runSingle = async () => {
    setRunning(true);
    try {
      const r = await runEndpointMatrixReplay({
        prospect_id: prospectId,
        mode: "single_replay",
        endpoint: singleEndpoint,
      });
      toast.success(`Endpoint ${singleEndpoint}: ${r.results?.[0]?.returned_contacts ?? 0} contatos`);
      await reload();
    } catch (e: any) {
      toast.error("Falha no replay", { description: e?.message });
    } finally { setRunning(false); }
  };

  const saveStrategy = async (v: string) => {
    if (!orgId) return;
    setStrategy(v);
    try {
      await setEndpointStrategy(orgId, v);
      toast.success(`Estratégia salva: ${v}`);
    } catch (e: any) {
      toast.error("Falha ao salvar estratégia", { description: e?.message });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Apollo Endpoint Matrix</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Descoberta automática do melhor endpoint por eficiência (contatos por crédito).
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={reload} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={runComparative} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <PlayCircle className="h-4 w-4 mr-1" />}
              Rodar Comparative Replay
            </Button>
            <Select value={singleEndpoint} onValueChange={setSingleEndpoint}>
              <SelectTrigger className="h-9 w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["organizations/enrich","mixed_people/search","mixed_people/api_search","people/search","contacts/search","mixed_companies/search"].map(e => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={runSingle} disabled={running}>
              Executar neste endpoint
            </Button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">Feature flag org:</span>
            <Select value={strategy} onValueChange={saveStrategy}>
              <SelectTrigger className="h-8 w-[240px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STRATEGIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {winner && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Trophy className="h-5 w-5 text-amber-500 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold">Recomendação</div>
              <div className="text-sm">
                Melhor endpoint: <code className="font-mono">{winner.endpoint}</code> · {winner.returned_contacts ?? 0} contatos
                · {winner.credits_used ?? "?"} créditos · confiança {winner.confidence_score?.toFixed(0) ?? "?"}%
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Matrix</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Endpoint</th>
                <th className="px-3 py-2">HTTP</th>
                <th className="px-3 py-2">Pessoas</th>
                <th className="px-3 py-2">Empresas</th>
                <th className="px-3 py-2">Créd.</th>
                <th className="px-3 py-2">Latência</th>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Fonte</th>
              </tr>
            </thead>
            <tbody>
              {latest.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum dado ainda. Rode um replay ou faça um Browser Parity com HAR.
                </td></tr>
              )}
              {latest.map((r, i) => (
                <tr key={r.id} className={r.recommended ? "bg-amber-500/10" : ""}>
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 font-mono">{r.endpoint}</td>
                  <td className="px-3 py-2">{r.http_status ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{r.returned_contacts ?? "—"}</td>
                  <td className="px-3 py-2">{r.returned_companies ?? "—"}</td>
                  <td className="px-3 py-2">{r.credits_used ?? "—"}</td>
                  <td className="px-3 py-2">{r.latency_ms != null ? `${r.latency_ms}ms` : "—"}</td>
                  <td className="px-3 py-2"><Stars n={r.stars} /></td>
                  <td className="px-3 py-2">{sourceBadge(r.source)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Endpoint Discovery</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2">Endpoint</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2">Cookie</th>
                <th className="px-3 py-2">GraphQL</th>
                <th className="px-3 py-2">Notas</th>
              </tr>
            </thead>
            <tbody>
              {discovery.map(d => (
                <tr key={d.id}>
                  <td className="px-3 py-2 font-mono">{d.endpoint}</td>
                  <td className="px-3 py-2">
                    <Badge variant={d.status === "documented" ? "default" : "secondary"}>{d.status}</Badge>
                  </td>
                  <td className="px-3 py-2">{d.requires_auth_scope ?? "—"}</td>
                  <td className="px-3 py-2">{d.requires_cookie ? "sim" : "—"}</td>
                  <td className="px-3 py-2">{d.graphql ? "sim" : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{d.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export default ApolloEndpointMatrixTab;
