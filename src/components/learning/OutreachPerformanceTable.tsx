import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOutreachPerformance } from "@/hooks/useOutreachPerformance";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Props {
  organizationId: string | undefined;
}

const channelColors: Record<string, string> = {
  email: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  whatsapp: "bg-green-500/10 text-green-700 dark:text-green-300",
  call: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
};

function rate(num: number, denom: number) {
  if (!denom) return "—";
  return `${((num / denom) * 100).toFixed(1)}%`;
}

export function OutreachPerformanceTable({ organizationId }: Props) {
  const { data, isLoading } = useOutreachPerformance(organizationId);

  if (isLoading) return <Skeleton className="h-80 w-full" />;

  const rows = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance de Outreach</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não há dados de outreach. Comece a enviar mensagens para popular este painel.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead className="text-right">Enviados</TableHead>
                  <TableHead className="text-right">Abertos</TableHead>
                  <TableHead className="text-right">Respostas</TableHead>
                  <TableHead className="text-right">Reuniões</TableHead>
                  <TableHead className="text-right">Wins</TableHead>
                  <TableHead className="text-right">Reply %</TableHead>
                  <TableHead className="text-right">Meeting %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Badge variant="secondary" className={channelColors[r.channel] ?? ""}>
                        {r.channel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.template_type}
                      {r.variant !== "default" && (
                        <span className="text-muted-foreground"> · {r.variant}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.sent}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.opened}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.replied}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.meetings}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.wins}</TableCell>
                    <TableCell className="text-right tabular-nums">{rate(r.replied, r.sent)}</TableCell>
                    <TableCell className="text-right tabular-nums">{rate(r.meetings, r.sent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
