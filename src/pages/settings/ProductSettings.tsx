import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CategoriesTab } from '@/components/products/CategoriesTab';
import { MeasurementUnitsTab } from '@/components/products/MeasurementUnitsTab';
import { Tags, Ruler } from 'lucide-react';

export default function ProductSettings() {
  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configurações de Produtos & Serviços</h1>
          <p className="text-muted-foreground">
            Gerencie categorias, unidades de medida e outras configurações do catálogo
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="categories">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="categories" className="flex items-center gap-2">
                  <Tags className="w-4 h-4" />
                  Categorias
                </TabsTrigger>
                <TabsTrigger value="units" className="flex items-center gap-2">
                  <Ruler className="w-4 h-4" />
                  Unidades de Medida
                </TabsTrigger>
              </TabsList>

              <TabsContent value="categories" className="mt-6">
                <CategoriesTab />
              </TabsContent>

              <TabsContent value="units" className="mt-6">
                <MeasurementUnitsTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
