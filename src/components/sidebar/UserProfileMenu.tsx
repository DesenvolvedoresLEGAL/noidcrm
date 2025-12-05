import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  Settings,
  LogOut,
  Moon,
  Sun,
  Monitor,
  HelpCircle,
  FileText,
  Users,
  ChevronRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface UserProfileMenuProps {
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  organization: {
    name: string;
    slug: string;
  } | null;
  userEmail?: string;
  roleBadge: {
    label: string;
    variant: 'default' | 'secondary' | 'outline';
  } | null;
  onLogout: () => void;
  collapsed?: boolean;
}

export function UserProfileMenu({
  profile,
  organization,
  userEmail,
  roleBadge,
  onLogout,
  collapsed = false,
}: UserProfileMenuProps) {
  const navigate = useNavigate();
  const { setTheme, theme } = useTheme();

  const firstName = profile?.full_name?.split(' ')[0] || 'Usuário';
  const initials = profile?.full_name?.[0]?.toUpperCase() || 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-3 w-full rounded-lg p-2 transition-colors',
            'hover:bg-sidebar-accent focus:outline-none focus:ring-2 focus:ring-primary/20',
            collapsed && 'justify-center'
          )}
        >
          <Avatar className="h-8 w-8 ring-2 ring-primary/10">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          {!collapsed && (
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-sidebar-foreground truncate">
                  {firstName}
                </span>
                {roleBadge && (
                  <Badge 
                    variant={roleBadge.variant} 
                    className="text-[10px] px-1.5 py-0 h-4"
                  >
                    {roleBadge.label}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground truncate block">
                @{organization?.slug || 'org'}
              </span>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        side="right" 
        align="end" 
        className="w-64 z-50 bg-popover"
        sideOffset={8}
      >
        {/* User Info Header */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col space-y-0.5">
              <p className="text-sm font-medium">{profile?.full_name || 'Usuário'}</p>
              <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                {userEmail || `@${organization?.slug}`}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Settings */}
        <DropdownMenuItem 
          onClick={() => navigate('/app/settings')}
          className="cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4" />
          Configurações
        </DropdownMenuItem>

        {/* Appearance Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            {theme === 'dark' ? (
              <Moon className="mr-2 h-4 w-4" />
            ) : theme === 'light' ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Monitor className="mr-2 h-4 w-4" />
            )}
            Aparência
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="bg-popover z-50">
            <DropdownMenuItem 
              onClick={() => setTheme('light')}
              className={cn('cursor-pointer', theme === 'light' && 'bg-accent')}
            >
              <Sun className="mr-2 h-4 w-4" />
              Claro
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setTheme('dark')}
              className={cn('cursor-pointer', theme === 'dark' && 'bg-accent')}
            >
              <Moon className="mr-2 h-4 w-4" />
              Escuro
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setTheme('system')}
              className={cn('cursor-pointer', theme === 'system' && 'bg-accent')}
            >
              <Monitor className="mr-2 h-4 w-4" />
              Sistema
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Documentation */}
        <DropdownMenuItem 
          onClick={() => window.open('https://docs.noidcrm.com', '_blank')}
          className="cursor-pointer"
        >
          <FileText className="mr-2 h-4 w-4" />
          Documentação
        </DropdownMenuItem>

        {/* Support */}
        <DropdownMenuItem 
          onClick={() => window.open('https://suporte.noidcrm.com', '_blank')}
          className="cursor-pointer"
        >
          <HelpCircle className="mr-2 h-4 w-4" />
          Suporte
        </DropdownMenuItem>

        {/* Community */}
        <DropdownMenuItem 
          onClick={() => window.open('https://comunidade.noidcrm.com', '_blank')}
          className="cursor-pointer"
        >
          <Users className="mr-2 h-4 w-4" />
          Comunidade
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Logout */}
        <DropdownMenuItem 
          onClick={onLogout}
          className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
