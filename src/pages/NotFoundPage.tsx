import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Users, Settings, Bug, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function NotFoundPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd' && !e.ctrlKey && !e.metaKey) {
        navigate('/');
      } else if (e.key === 'l' && !e.ctrlKey && !e.metaKey) {
        navigate('/leads');
      } else if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
        navigate('/settings');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="text-8xl font-black bg-gradient-primary bg-clip-text text-transparent">
            404
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Perdido no Backhaul?
          </h1>
          <p className="text-muted-foreground text-lg">
            Parece que essa rota não existe no nosso mapa de rede. 
            Vamos te reconectar ao caminho certo!
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
            onClick={() => navigate('/')}
          >
            <Home className="h-6 w-6" />
            <span className="text-sm">Dashboard</span>
            <kbd className="text-xs bg-muted px-2 py-0.5 rounded">D</kbd>
          </Button>
          
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
            onClick={() => navigate('/leads')}
          >
            <Users className="h-6 w-6" />
            <span className="text-sm">Leads</span>
            <kbd className="text-xs bg-muted px-2 py-0.5 rounded">L</kbd>
          </Button>
          
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
            onClick={() => navigate('/settings')}
          >
            <Settings className="h-6 w-6" />
            <span className="text-sm">Settings</span>
            <kbd className="text-xs bg-muted px-2 py-0.5 rounded">S</kbd>
          </Button>
          
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4"
            onClick={() => window.open('https://github.com/yourusername/legal-crm/issues', '_blank')}
          >
            <Bug className="h-6 w-6" />
            <span className="text-sm">Reportar</span>
          </Button>
        </div>

        <form onSubmit={handleSearch} className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Busca rápida..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </form>

        <p className="text-sm text-muted-foreground">
          Dica: Use os atalhos de teclado para navegar mais rápido
        </p>
      </div>
    </div>
  );
}
