import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Video } from 'lucide-react';

export default function VideoLibrary() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Video className="h-8 w-8 text-primary" />
              Biblioteca de Vídeos
            </h1>
            <p className="text-muted-foreground">Micro-vídeos de treinamento</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/app/roleplay')}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>

        <Card className="p-12 text-center">
          <Video className="h-16 w-16 mx-auto mb-4 text-muted" />
          <h3 className="text-xl font-semibold mb-2">Em Construção</h3>
          <p className="text-muted-foreground">
            A biblioteca de vídeos será exibida aqui em breve
          </p>
        </Card>
      </div>
    </Layout>
  );
}