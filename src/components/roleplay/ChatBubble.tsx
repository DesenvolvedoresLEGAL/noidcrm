import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatBubbleProps {
  sender: 'seller' | 'ai_client';
  content: string;
  timestamp: string | Date;
  clientName?: string;
  userAvatarUrl?: string | null;
  userName?: string | null;
}

export function ChatBubble({ sender, content, timestamp, clientName, userAvatarUrl, userName }: ChatBubbleProps) {
  const isSeller = sender === 'seller';
  const displayName = isSeller ? (userName || 'Você') : (clientName || 'Cliente');
  const initials = isSeller ? (userName?.charAt(0).toUpperCase() || 'V') : 'C';

  return (
    <div className={cn(
      'flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300',
      isSeller ? 'flex-row-reverse' : 'flex-row'
    )}>
      <Avatar className={cn(
        'h-8 w-8 shrink-0',
        isSeller ? 'bg-primary' : 'bg-secondary'
      )}>
        {isSeller && userAvatarUrl && (
          <AvatarImage src={userAvatarUrl} alt={displayName} />
        )}
        <AvatarFallback className={cn(
          'text-xs font-medium',
          isSeller ? 'text-primary-foreground' : 'text-secondary-foreground'
        )}>
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className={cn(
        'flex flex-col gap-1 max-w-[75%]',
        isSeller ? 'items-end' : 'items-start'
      )}>
        <span className="text-xs text-muted-foreground px-1">
          {displayName}
        </span>
        
        <div className={cn(
          'px-4 py-2.5 rounded-2xl',
          isSeller 
            ? 'bg-primary text-primary-foreground rounded-tr-sm' 
            : 'bg-muted rounded-tl-sm'
        )}>
          <p className="text-sm whitespace-pre-wrap break-words">
            {content}
          </p>
        </div>

        <span className="text-[10px] text-muted-foreground px-1">
          {format(new Date(timestamp), 'HH:mm', { locale: ptBR })}
        </span>
      </div>
    </div>
  );
}
