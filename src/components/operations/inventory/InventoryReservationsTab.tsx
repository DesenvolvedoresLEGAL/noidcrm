import { useState } from 'react';
import { CalendarRange, Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InventoryPreReservationsTab } from './InventoryPreReservationsTab';
import { InventoryDefinitiveReservationsTab } from './InventoryDefinitiveReservationsTab';

export function InventoryReservationsTab() {
  const [tab, setTab] = useState('pre');
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="pre">Pré reservas</TabsTrigger>
        <TabsTrigger value="definitive">Reservas definitivas</TabsTrigger>
        <TabsTrigger value="calendar">Calendário de ocupação</TabsTrigger>
      </TabsList>
      <TabsContent value="pre">
        <InventoryPreReservationsTab />
      </TabsContent>
      <TabsContent value="definitive">
        <InventoryDefinitiveReservationsTab />
      </TabsContent>
      <TabsContent value="calendar">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="rounded-full bg-muted p-4">
              <CalendarRange className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Calendário de ocupação</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Visualização em calendário das pré reservas e ocupação de inventário será
              implementada na próxima sprint.
            </p>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Construction className="h-3.5 w-3.5" /> Em desenvolvimento
            </span>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
