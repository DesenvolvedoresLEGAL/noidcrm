import { Link } from 'react-router-dom';
import { ArrowRight, GitBranch } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDateBR } from '@/lib/dateUtils';

interface HandoffBadgeProps {
  qualifiedBy: {
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  sourceOpportunity: {
    id: string;
    title: string;
    pipeline: { name: string } | null;
    stage: { name: string } | null;
  } | null;
  qualifiedAt: string | null;
}

export function HandoffBadge({ 
  qualifiedBy, 
  sourceOpportunity, 
  qualifiedAt 
}: HandoffBadgeProps) {
  if (!qualifiedBy && !sourceOpportunity) return null;

  const initials = qualifiedBy?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  return (
    <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <GitBranch className="h-3.5 w-3.5" />
        <span>Passagem de Bastão</span>
      </div>

      <div className="flex items-center gap-2">
        {qualifiedBy && (
          <>
            <Avatar className="h-7 w-7">
              <AvatarImage src={qualifiedBy.avatar_url || undefined} />
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {qualifiedBy.full_name || 'Usuário'}
              </p>
              {sourceOpportunity?.pipeline?.name && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {sourceOpportunity.pipeline.name}
                  {sourceOpportunity.stage?.name && ` • ${sourceOpportunity.stage.name}`}
                </p>
              )}
            </div>
          </>
        )}
        
        {!qualifiedBy && sourceOpportunity && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              De: {sourceOpportunity.pipeline?.name || 'Pipeline anterior'}
            </p>
          </div>
        )}

        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-primary font-medium">Você</span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        {qualifiedAt && (
          <span>{formatDateBR(qualifiedAt)}</span>
        )}
        {sourceOpportunity && (
          <Link 
            to={`/app/opportunities/${sourceOpportunity.id}`}
            className="text-primary hover:underline"
          >
            Ver opp original
          </Link>
        )}
      </div>
    </div>
  );
}
