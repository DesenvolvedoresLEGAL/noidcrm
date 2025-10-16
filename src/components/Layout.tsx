import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Target, 
  FileText, 
  FileCheck, 
  BarChart3, 
  Zap, 
  Settings,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/leads', label: 'Leads', icon: Users },
  { path: '/opportunities', label: 'Oportunidades', icon: Target },
  { path: '/proposals', label: 'Propostas', icon: FileText },
  { path: '/contracts', label: 'Contratos', icon: FileCheck },
  { path: '/sequences', label: 'Cadências', icon: Zap },
  { path: '/reports', label: 'Relatórios', icon: BarChart3 },
  { path: '/settings', label: 'Configurações', icon: Settings },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { auth } = useFirebaseAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: 'Logout realizado com sucesso' });
    } catch (error) {
      toast({ 
        title: 'Erro ao fazer logout', 
        variant: 'destructive' 
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-black bg-gradient-primary bg-clip-text text-transparent">
            LEGAL CRM
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  className={`w-full justify-start ${isActive ? 'bg-primary/10 text-primary hover:bg-primary/20' : ''}`}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
