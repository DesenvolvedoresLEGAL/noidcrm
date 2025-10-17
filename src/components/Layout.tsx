import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Target,
  CheckSquare,
  FileCheck, 
  BarChart3, 
  GitBranch, 
  Settings,
  LogOut,
  Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { MobileNav } from '@/components/MobileNav';

interface LayoutProps {
  children: ReactNode;
}

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/opportunities', label: 'Pipeline', icon: Target },
    { path: '/activities', label: 'Atividades', icon: CheckSquare },
    { path: '/contracts', label: 'Contratos', icon: FileCheck },
    { path: '/sequences', label: 'Cadências', icon: GitBranch },
    { path: '/reports', label: 'Relatórios', icon: BarChart3 },
    { path: '/insights', label: 'Insights', icon: Lightbulb },
    { path: '/settings', label: 'Configurações', icon: Settings },
  ];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { auth, isMockMode } = useFirebaseAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      if (isMockMode) {
        localStorage.removeItem('mockAuthUser');
        window.location.href = '/auth';
        return;
      }
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
      {/* Sidebar - Hidden on mobile */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-black bg-gradient-primary bg-clip-text text-transparent">
            LEGAL CRM
          </h1>
          {isMockMode && (
            <div className="mt-3 px-3 py-1.5 bg-primary/10 rounded-lg flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-medium text-primary">Modo Demo</span>
            </div>
          )}
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

        <div className="p-4 border-t border-border space-y-2">
          <div className="flex items-center justify-center mb-2">
            <ThemeToggle />
          </div>
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
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
}
