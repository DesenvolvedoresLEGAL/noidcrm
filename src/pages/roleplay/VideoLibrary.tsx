import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Video } from 'lucide-react';

export default function VideoLibrary() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground flex items-center gap-3">
              <Video className="h-8 w-8 text-indigo-600" />
              Biblioteca de Vídeos
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Micro-vídeos de treinamento e desenvolvimento
            </p>
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