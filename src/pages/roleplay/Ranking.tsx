import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Trophy } from 'lucide-react';

export default function Ranking() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Trophy className="h-8 w-8 text-warning" />
              Ranking de Performance
            </h1>
            <p className="text-muted-foreground">Compare seu desempenho com o time</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/app/roleplay')}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>

        <Card className="p-12 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted" />
          <h3 className="text-xl font-semibold mb-2">Em Construção</h3>
          <p className="text-muted-foreground">
            O ranking será exibido aqui em breve
          </p>
        </Card>
      </div>
    </Layout>
  );
}