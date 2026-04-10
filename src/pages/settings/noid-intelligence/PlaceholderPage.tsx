import { useNavigate } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Construction className="h-8 w-8 text-muted-foreground" />
      </div>
      <Badge variant="secondary" className="mb-4 gap-1">
        <Construction className="h-3 w-3" /> Em construção
      </Badge>
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-muted-foreground mt-2 max-w-md">{description}</p>
      <Button
        variant="outline"
        className="mt-6 gap-2"
        onClick={() => navigate('/app/settings/noid-intelligence')}
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Hub
      </Button>
    </div>
  );
}
