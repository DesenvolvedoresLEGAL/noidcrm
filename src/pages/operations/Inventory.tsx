import { useState } from 'react';
import { Boxes, Construction } from 'lucide-react';
import { PageContainer } from '@/components/ui/page-container';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccessDenied } from '@/components/AccessDenied';
import { usePermissions } from '@/hooks/usePermissions';
import { InventoryOverviewTab } from '@/components/operations/inventory/InventoryOverviewTab';
import { InventoryItemsTab } from '@/components/operations/inventory/InventoryItemsTab';
import { InventoryCategoriesTab } from '@/components/operations/inventory/InventoryCategoriesTab';
import { InventoryFamiliesTab } from '@/components/operations/inventory/InventoryFamiliesTab';
import { InventoryLocationsTab } from '@/components/operations/inventory/InventoryLocationsTab';
import { InventoryReservationsTab } from '@/components/operations/inventory/InventoryReservationsTab';

export default function Inventory() {
  const { isOwner, isAdmin, orgRole, loading } = usePermissions();
  const [tab, setTab] = useState('overview');

  if (loading) return null;

  const canAccess =
    isOwner || isAdmin || orgRole === 'operations' || orgRole === 'operacional';

  if (!canAccess) {
    return (
      <AccessDenied
        title="Acesso restrito"
        description="O módulo Inventário está disponível apenas para perfis operacionais (Owner, Admin ou Operacional)."
      />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        icon={Boxes}
        title="Inventário"
        subtitle="Controle operacional de equipamentos, chips, kits, reservas e disponibilidade."
        badge={{ label: 'Módulo em implantação', icon: Construction }}
        variant="teal"
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="items">Itens</TabsTrigger>
          <TabsTrigger value="reservations">Reservas</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="families">Famílias</TabsTrigger>
          <TabsTrigger value="locations">Locais</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <InventoryOverviewTab onNavigateToItems={() => setTab('items')} />
        </TabsContent>
        <TabsContent value="items">
          <InventoryItemsTab />
        </TabsContent>
        <TabsContent value="reservations">
          <InventoryReservationsTab />
        </TabsContent>
        <TabsContent value="categories">
          <InventoryCategoriesTab />
        </TabsContent>
        <TabsContent value="families">
          <InventoryFamiliesTab />
        </TabsContent>
        <TabsContent value="locations">
          <InventoryLocationsTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
