import { Layout } from '@/components/Layout';
import { PipelineHealthDashboard } from '@/components/reports/PipelineHealthDashboard';

export default function Forecast() {
  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-black text-foreground">Forecast de Vendas</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Análise de saúde do pipeline e previsão de receita
          </p>
        </div>

        <PipelineHealthDashboard />
      </div>
    </Layout>
  );
}
