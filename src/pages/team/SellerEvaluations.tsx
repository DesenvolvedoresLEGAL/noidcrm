import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SellerFitScoreEvaluationForm, SellerEvaluationsList, FitScoreConfigManager } from '@/components/team/evaluations';
import { Plus, Settings, List } from 'lucide-react';

export default function SellerEvaluations() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Avaliações de FitScore</h1>
          <p className="text-muted-foreground">Avalie o Fit Cultural e Desempenho dos vendedores</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Avaliação
          </Button>
        )}
      </div>

      {showForm ? (
        <SellerFitScoreEvaluationForm
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <Tabs defaultValue="evaluations">
          <TabsList>
            <TabsTrigger value="evaluations" className="gap-2">
              <List className="h-4 w-4" />
              Avaliações
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" />
              Configuração
            </TabsTrigger>
          </TabsList>
          <TabsContent value="evaluations" className="mt-4">
            <SellerEvaluationsList />
          </TabsContent>
          <TabsContent value="config" className="mt-4">
            <FitScoreConfigManager />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
