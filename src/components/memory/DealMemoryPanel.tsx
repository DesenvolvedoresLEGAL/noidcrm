import { useState } from 'react';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  MessageSquare, 
  Shield,
  ChevronRight,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { MemoryCard } from './MemoryCard';
import { 
  useRelevantMemories, 
  useRecordMemoryRead,
  useUpdateMemoryOutcome,
  type MemoryType 
} from '@/hooks/useMemories';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface DealMemoryPanelProps {
  opportunityId: string;
  industry?: string;
  stage?: string;
  pipelineId?: string;
}

const memoryCategories: { 
  key: MemoryType[]; 
  label: string; 
  icon: typeof Brain;
  description: string;
}[] = [
  {
    key: ['win_pattern', 'converting_language'],
    label: 'Sucesso',
    icon: TrendingUp,
    description: 'Padrões e linguagem que convertem'
  },
  {
    key: ['objection', 'countermeasure'],
    label: 'Objeções',
    icon: MessageSquare,
    description: 'Objeções comuns e contramedidas'
  },
  {
    key: ['loss_pattern', 'churn_signal'],
    label: 'Riscos',
    icon: AlertTriangle,
    description: 'Sinais de perda e churn'
  }
];

export function DealMemoryPanel({
  opportunityId,
  industry,
  stage,
  pipelineId
}: DealMemoryPanelProps) {
  const [activeTab, setActiveTab] = useState('sucesso');
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [lastReadId, setLastReadId] = useState<Record<string, string>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const queryClient = useQueryClient();
  const recordRead = useRecordMemoryRead();
  const updateOutcome = useUpdateMemoryOutcome();

  // Fetch relevant memories for each category
  const { data: successMemories, isLoading: loadingSuccess, refetch: refetchSuccess } = useRelevantMemories({
    memoryTypes: ['win_pattern', 'converting_language'],
    industry,
    stage,
    pipelineId,
    limit: 5
  });

  const { data: objectionMemories, isLoading: loadingObjections, refetch: refetchObjections } = useRelevantMemories({
    memoryTypes: ['objection', 'countermeasure'],
    industry,
    stage,
    pipelineId,
    limit: 5
  });

  const { data: riskMemories, isLoading: loadingRisks, refetch: refetchRisks } = useRelevantMemories({
    memoryTypes: ['loss_pattern', 'churn_signal'],
    industry,
    stage,
    pipelineId,
    limit: 5
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Invalidate all memory-related queries
      await queryClient.invalidateQueries({ queryKey: ['relevant-memories'] });
      await queryClient.invalidateQueries({ queryKey: ['memories'] });
      
      // Refetch all
      await Promise.all([
        refetchSuccess(),
        refetchObjections(),
        refetchRisks()
      ]);
      
      toast.success('Memórias atualizadas');
    } catch (error) {
      console.error('Error refreshing memories:', error);
      toast.error('Erro ao atualizar memórias');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMemoryClick = async (memoryId: string) => {
    setSelectedMemoryId(memoryId);
    
    // Record the read and store the read ID
    try {
      const result = await recordRead.mutateAsync({
        memoryId,
        context: 'deal_analysis',
        entityType: 'opportunity',
        entityId: opportunityId,
        triggeredBy: 'user'
      });
      
      if (result?.id) {
        setLastReadId(prev => ({ ...prev, [memoryId]: result.id }));
      }
    } catch (error) {
      console.error('Failed to record memory read:', error);
    }
  };

  const handleApply = async (memoryId: string) => {
    const readId = lastReadId[memoryId];
    if (readId) {
      try {
        await updateOutcome.mutateAsync({
          readId,
          outcome: 'applied',
          effectivenessScore: 0.8
        });
      } catch (error) {
        console.error('Failed to update memory outcome:', error);
      }
    }
  };

  const handleReject = async (memoryId: string) => {
    const readId = lastReadId[memoryId];
    if (readId) {
      try {
        await updateOutcome.mutateAsync({
          readId,
          outcome: 'rejected'
        });
      } catch (error) {
        console.error('Failed to update memory outcome:', error);
      }
    }
  };

  const getMemoriesForTab = () => {
    switch (activeTab) {
      case 'sucesso':
        return { memories: successMemories, loading: loadingSuccess };
      case 'objecoes':
        return { memories: objectionMemories, loading: loadingObjections };
      case 'riscos':
        return { memories: riskMemories, loading: loadingRisks };
      default:
        return { memories: [], loading: false };
    }
  };

  const { memories, loading } = getMemoriesForTab();
  const totalMemories = (successMemories?.length || 0) + (objectionMemories?.length || 0) + (riskMemories?.length || 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Memória Organizacional</CardTitle>
            {totalMemories > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {totalMemories} relevantes
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRefresh}
            disabled={isRefreshing || loadingSuccess || loadingObjections || loadingRisks}
          >
            <RefreshCw className={cn(
              "h-3.5 w-3.5",
              (isRefreshing || loadingSuccess || loadingObjections || loadingRisks) && "animate-spin"
            )} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3 h-8">
            <TabsTrigger value="sucesso" className="text-xs data-[state=active]:text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              Sucesso
              {successMemories?.length ? ` (${successMemories.length})` : ''}
            </TabsTrigger>
            <TabsTrigger value="objecoes" className="text-xs data-[state=active]:text-orange-600">
              <MessageSquare className="h-3 w-3 mr-1" />
              Objeções
              {objectionMemories?.length ? ` (${objectionMemories.length})` : ''}
            </TabsTrigger>
            <TabsTrigger value="riscos" className="text-xs data-[state=active]:text-red-600">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Riscos
              {riskMemories?.length ? ` (${riskMemories.length})` : ''}
            </TabsTrigger>
          </TabsList>

          <div className="mt-3">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : memories?.length ? (
              <ScrollArea className="h-[280px] pr-2">
                <div className="space-y-2">
                  {memories.map((memory) => (
                    <MemoryCard
                      key={memory.id}
                      memory={memory}
                      compact={false}
                      showActions={!!lastReadId[memory.id]}
                      onClick={() => handleMemoryClick(memory.id)}
                      onApply={() => handleApply(memory.id)}
                      onReject={() => handleReject(memory.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma memória encontrada
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  O sistema aprenderá com ganhos e perdas
                </p>
              </div>
            )}
          </div>
        </Tabs>

        {/* Link to Memory Explorer */}
        <div className="mt-3 pt-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-xs h-8"
            asChild
          >
            <a href="/app/intelligence/memories">
              <span className="flex items-center gap-1.5">
                <Brain className="h-3 w-3" />
                Explorar todas as memórias
              </span>
              <ChevronRight className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
