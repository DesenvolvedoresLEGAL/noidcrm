import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InventorySerializedItemsTab } from './InventorySerializedItemsTab';
import { InventoryQuantityItemsTab } from './InventoryQuantityItemsTab';

export function InventoryItemsTab() {
  return (
    <Tabs defaultValue="serialized" className="space-y-4">
      <TabsList>
        <TabsTrigger value="serialized">Serializados</TabsTrigger>
        <TabsTrigger value="quantity">Por quantidade</TabsTrigger>
      </TabsList>
      <TabsContent value="serialized">
        <InventorySerializedItemsTab />
      </TabsContent>
      <TabsContent value="quantity">
        <InventoryQuantityItemsTab />
      </TabsContent>
    </Tabs>
  );
}
