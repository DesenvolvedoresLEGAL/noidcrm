import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InventoryPreReservationsTab } from './InventoryPreReservationsTab';
import { InventoryDefinitiveReservationsTab } from './InventoryDefinitiveReservationsTab';
import { InventoryOccupancyCalendarPage } from './InventoryOccupancyCalendarPage';
import { InventoryPricingRulesTab } from './InventoryPricingRulesTab';

export function InventoryReservationsTab() {
  const [tab, setTab] = useState('pre');
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="pre">Pré reservas</TabsTrigger>
        <TabsTrigger value="definitive">Reservas definitivas</TabsTrigger>
        <TabsTrigger value="calendar">Calendário de ocupação</TabsTrigger>
        <TabsTrigger value="pricing">Regras de preço</TabsTrigger>
      </TabsList>
      <TabsContent value="pre">
        <InventoryPreReservationsTab />
      </TabsContent>
      <TabsContent value="definitive">
        <InventoryDefinitiveReservationsTab />
      </TabsContent>
      <TabsContent value="calendar">
        <InventoryOccupancyCalendarPage />
      </TabsContent>
      <TabsContent value="pricing">
        <InventoryPricingRulesTab />
      </TabsContent>
    </Tabs>
  );
}
