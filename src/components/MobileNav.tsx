import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Target, CheckSquare, FileCheck, GitBranch, BarChart3, Settings, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/opportunities', label: 'Pipeline', icon: Target },
    { path: '/activities', label: 'Atividades', icon: CheckSquare },
    { path: '/contracts', label: 'Contratos', icon: FileCheck },
    { path: '/sequences', label: 'Cadências', icon: GitBranch },
    { path: '/reports', label: 'Relatórios', icon: BarChart3 },
    { path: '/insights', label: 'Insights', icon: Lightbulb },
    { path: '/settings', label: 'Config', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className={cn('h-5 w-5 mb-0.5', isActive && 'animate-scale-in')} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
