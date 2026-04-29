import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CloserListItemRow } from './CloserListItemRow';
import type { CloserListItem } from '@/types/dashboard/closer';

interface Props {
  expiringToday: CloserListItem[];
  expiring48h: CloserListItem[];
  expired: CloserListItem[];
  viewedNoFollowup: CloserListItem[];
}

function List({ items, empty }: { items: CloserListItem[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground py-3">{empty}</p>;
  }
  return (
    <ul className="divide-y">
      {items.map((it) => (
        <CloserListItemRow key={`${it.kind}-${it.id}`} item={it} />
      ))}
    </ul>
  );
}

function Count({ n }: { n: number }) {
  return (
    <Badge variant={n > 0 ? 'default' : 'outline'} className="ml-1 text-[10px] px-1.5 h-4">
      {n}
    </Badge>
  );
}

export function CloserProposalsActionGroup({
  expiringToday,
  expiring48h,
  expired,
  viewedNoFollowup,
}: Props) {
  const total = expiringToday.length + expiring48h.length + expired.length + viewedNoFollowup.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Propostas que exigem ação</CardTitle>
        <p className="text-xs text-muted-foreground">
          Agrupado por urgência. Trate primeiro o que está vencendo ou já vencido.
        </p>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Nenhuma proposta exigindo ação agora.
          </p>
        ) : (
          <Tabs defaultValue="today">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="today">
                Vencendo hoje <Count n={expiringToday.length} />
              </TabsTrigger>
              <TabsTrigger value="next48h">
                Em 48h <Count n={expiring48h.length} />
              </TabsTrigger>
              <TabsTrigger value="expired">
                Vencidas <Count n={expired.length} />
              </TabsTrigger>
              <TabsTrigger value="viewed">
                Visualizadas sem ação <Count n={viewedNoFollowup.length} />
              </TabsTrigger>
            </TabsList>
            <TabsContent value="today">
              <List items={expiringToday} empty="Nenhuma proposta com prazo final hoje." />
            </TabsContent>
            <TabsContent value="next48h">
              <List items={expiring48h} empty="Nenhuma proposta vencendo nas próximas 48h." />
            </TabsContent>
            <TabsContent value="expired">
              <List items={expired} empty="Nenhuma proposta vencida sem aceite." />
            </TabsContent>
            <TabsContent value="viewed">
              <List
                items={viewedNoFollowup}
                empty="Todas as propostas visualizadas tiveram follow up."
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
