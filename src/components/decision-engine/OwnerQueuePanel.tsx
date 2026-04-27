import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { formatDateBR } from "@/lib/dateUtils";

interface QueueRow {
  id: string;
  user_id: string;
  role: string | null;
  weight: number;
  is_active: boolean;
  last_assigned_at: string | null;
  total_assigned: number;
  profile?: { full_name: string | null; email: string | null };
}

export function OwnerQueuePanel({ organizationId }: { organizationId: string | undefined }) {
  const { data, isLoading } = useQuery({
    queryKey: ["owner-queue", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data: queue, error } = await supabase
        .from("owner_queue" as any)
        .select("*")
        .eq("organization_id", organizationId!)
        .order("last_assigned_at", { ascending: true, nullsFirst: true });
      if (error) throw error;

      const ids = ((queue ?? []) as any[]).map((q) => q.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
        : { data: [] as any[] };
      const pmap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
      return ((queue ?? []) as any[]).map((q) => ({ ...q, profile: pmap[q.user_id] })) as QueueRow[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum owner na fila ainda. Owners são adicionados automaticamente quando recebem a primeira atribuição via decision engine.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((row) => (
        <Card key={row.id}>
          <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-medium text-sm">
                {row.profile?.full_name ?? row.profile?.email ?? row.user_id.slice(0, 8)}
              </div>
              <div className="text-xs text-muted-foreground flex gap-2 mt-1">
                {row.role && <Badge variant="outline">{row.role}</Badge>}
                <Badge variant="secondary">peso {row.weight}</Badge>
                {!row.is_active && <Badge variant="destructive">inativo</Badge>}
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              <div>Atribuídos: <span className="font-medium">{row.total_assigned}</span></div>
              <div>
                Última: {row.last_assigned_at ? formatDateBR(row.last_assigned_at) : "—"}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
