import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Owner {
  user_id: string;
  full_name: string | null;
  avatar_url?: string | null;
  email?: string | null;
}

interface User {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
}

interface OwnerSelectorProps {
  currentOwner: Owner | null;
  users: User[];
  onChangeOwner: (userId: string) => Promise<void>;
  disabled?: boolean;
}

export function OwnerSelector({
  currentOwner,
  users,
  onChangeOwner,
  disabled = false,
}: OwnerSelectorProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getFirstName = (name: string | null) => {
    if (!name) return 'Sem dono';
    const firstName = name.split(' ')[0];
    return firstName.length > 10 ? firstName.slice(0, 10) + '...' : firstName;
  };

  const handleSelectOwner = async (userId: string) => {
    if (userId === currentOwner?.user_id || isUpdating) return;
    // Sprint Active Users SoT: nunca permitir atribuir a usuário inativo.
    const target = users.find((u) => u.id === userId);
    if (!target || target.name?.toLowerCase().includes('(inativo)')) {
      return;
    }
    setIsUpdating(true);
    try {
      await onChangeOwner(userId);
    } finally {
      setIsUpdating(false);
    }
  };

  const isCurrentOwnerInactive =
    !!currentOwner?.user_id && !users.some((u) => u.id === currentOwner.user_id);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || isUpdating}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-full",
          "bg-muted/50 hover:bg-muted transition-colors",
          "text-xs font-medium text-foreground",
          "border border-border/50",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
          disabled && "opacity-50 cursor-not-allowed",
          isUpdating && "animate-pulse"
        )}
      >
        <Avatar className="h-5 w-5">
          <AvatarImage src={currentOwner?.avatar_url || undefined} />
          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
            {getInitials(currentOwner?.full_name)}
          </AvatarFallback>
        </Avatar>
        <span className="max-w-[60px] truncate">
          {getFirstName(currentOwner?.full_name)}
        </span>
        {isCurrentOwnerInactive && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-destructive/10 text-destructive font-semibold">
            Inativo
          </span>
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="start" className="w-64">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Responsável
        </div>
        {users.map((user) => (
          <DropdownMenuItem
            key={user.id}
            onClick={() => handleSelectOwner(user.id)}
            className={cn(
              "flex items-center gap-2 cursor-pointer",
              currentOwner?.user_id === user.id && "bg-accent"
            )}
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              {user.email && (
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              )}
            </div>
            {currentOwner?.user_id === user.id && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
