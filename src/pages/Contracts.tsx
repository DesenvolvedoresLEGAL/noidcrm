import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';

export default function Contracts() {
  return (
    <Layout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-black text-foreground">Contratos</h1>
          <p className="text-muted-foreground mt-1">
            Gestão de contratos e assinaturas
          </p>
        </div>

        <Card className="shadow-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            Módulo de contratos em desenvolvimento
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
