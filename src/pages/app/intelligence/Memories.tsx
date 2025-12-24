import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/ui/page-header';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  MessageSquare,
  Shield,
  Search,
  Filter,
  Plus,
  Eye,
  CheckCircle2,
  XCircle,
  BarChart3,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MemoryCard } from '@/components/memory/MemoryCard';
import { 
  useMemories, 
  useMemoryStats, 
  useCreateMemory,
  useUpdateMemory,
  useSemanticMemorySearch,
  type Memory,
  type MemoryType 
} from '@/hooks/useMemories';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';
import { PendingMemoriesButton } from '@/components/memory/PendingMemoriesButton';

const memoryTypes: { value: MemoryType; label: string; icon: typeof Brain; color: string }[] = [
  { value: 'win_pattern', label: 'Padrão de Ganho', icon: TrendingUp, color: 'text-green-600' },
  { value: 'loss_pattern', label: 'Padrão de Perda', icon: TrendingDown, color: 'text-red-600' },
  { value: 'objection', label: 'Objeção', icon: MessageSquare, color: 'text-orange-600' },
  { value: 'countermeasure', label: 'Contramedida', icon: Shield, color: 'text-purple-600' },
  { value: 'churn_signal', label: 'Sinal de Churn', icon: AlertTriangle, color: 'text-amber-600' },
  { value: 'converting_language', label: 'Linguagem que Converte', icon: MessageSquare, color: 'text-blue-600' }
];

export default function Memories() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [useSemanticSearch, setUseSemanticSearch] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const debouncedSearch = useDebounce(searchTerm, 500);

  const { data: memories, isLoading, refetch } = useMemories({
    memoryTypes: filterType !== 'all' ? [filterType as MemoryType] : undefined,
    status: filterStatus !== 'all' ? filterStatus : undefined
  });

  // Semantic search for more intelligent results
  const { 
    data: semanticResults, 
    isLoading: semanticLoading,
    refetch: refetchSemantic
  } = useSemanticMemorySearch(debouncedSearch, {
    memoryTypes: filterType !== 'all' ? [filterType as MemoryType] : undefined,
    enabled: useSemanticSearch && debouncedSearch.length >= 3
  });

  const { data: stats, refetch: refetchStats } = useMemoryStats();
  const createMemory = useCreateMemory();
  const updateMemory = useUpdateMemory();

  // Use semantic results when available, otherwise filter locally
  const filteredMemories = useSemanticSearch && debouncedSearch.length >= 3 && semanticResults?.memories?.length
    ? semanticResults.memories
    : memories?.filter(m => 
        !searchTerm || 
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.keywords?.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()))
      );

  const handleCreateMemory = async (data: Partial<Memory>) => {
    await createMemory.mutateAsync(data);
    setIsCreateOpen(false);
  };

  const handleValidate = async (memory: Memory) => {
    const result = await updateMemory.mutateAsync({
      id: memory.id,
      validated: !memory.validated,
      validated_at: !memory.validated ? new Date().toISOString() : null
    });
    // Update selectedMemory to reflect changes in Dialog
    if (result) {
      setSelectedMemory(result as Memory);
    }
  };

  const handleArchive = async (memory: Memory) => {
    const result = await updateMemory.mutateAsync({
      id: memory.id,
      status: memory.status === 'active' ? 'archived' : 'active'
    });
    // Update selectedMemory to reflect changes in Dialog
    if (result) {
      setSelectedMemory(result as Memory);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        refetchStats(),
        ...(debouncedSearch.length >= 3 ? [refetchSemantic()] : [])
      ]);
      toast.success('Memórias atualizadas');
    } catch (error) {
      console.error('Error refreshing memories:', error);
      toast.error('Erro ao atualizar memórias');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Memórias | NOID CRM</title>
      </Helmet>

      <div className="flex-1 space-y-4 p-4 md:p-6 pt-4">
        {/* Header */}
        <PageHeader
          icon={Brain}
          title="Memória Organizacional"
          subtitle="Aprendizados extraídos automaticamente de ganhos, perdas e comportamentos"
          badge={{ label: "AI", icon: Sparkles }}
          variant="teal"
          actions={
            <div className="flex items-center gap-2">
              <PendingMemoriesButton onComplete={() => handleRefresh()} />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
              >
                <RefreshCw className={cn("h-4 w-4 mr-1", (isRefreshing || isLoading) && "animate-spin")} />
                Atualizar
              </Button>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Nova Memória
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Memória Manual</DialogTitle>
                  </DialogHeader>
                  <CreateMemoryForm onSubmit={handleCreateMemory} />
                </DialogContent>
              </Dialog>
            </div>
          }
        />

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total de Memórias</p>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                </div>
                <Brain className="h-8 w-8 text-primary/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Memórias Ativas</p>
                  <p className="text-2xl font-bold">{stats?.active || 0}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total de Usos</p>
                  <p className="text-2xl font-bold">{stats?.totalUsage || 0}</p>
                </div>
                <Eye className="h-8 w-8 text-blue-500/20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Taxa de Eficácia</p>
                  <p className="text-2xl font-bold">
                    {stats?.avgSuccessRate ? `${Math.round(stats.avgSuccessRate * 100)}%` : '-'}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-500/20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Distribution by Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribuição por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {memoryTypes.map(type => {
                const count = stats?.byType?.[type.value] || 0;
                const Icon = type.icon;
                return (
                  <Badge
                    key={type.value}
                    variant="secondary"
                    className={cn(
                      "cursor-pointer transition-all",
                      filterType === type.value && "ring-2 ring-primary"
                    )}
                    onClick={() => setFilterType(filterType === type.value ? 'all' : type.value)}
                  >
                    <Icon className={cn("h-3 w-3 mr-1", type.color)} />
                    {type.label}: {count}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar memórias semanticamente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Button
              variant={useSemanticSearch ? "default" : "outline"}
              size="sm"
              onClick={() => setUseSemanticSearch(!useSemanticSearch)}
              className="whitespace-nowrap"
            >
              <Sparkles className={cn("h-4 w-4 mr-1", useSemanticSearch && "text-yellow-300")} />
              Busca Semântica
            </Button>
          </div>
          
          {/* Semantic search info */}
          {useSemanticSearch && debouncedSearch.length >= 3 && semanticResults?.query_expansion && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              <span>Termos expandidos:</span>
              <div className="flex flex-wrap gap-1">
                {semanticResults.query_expansion.slice(0, 8).map((term, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                    {term}
                  </Badge>
                ))}
              </div>
              {semanticResults.total_searched && (
                <span className="ml-auto">({semanticResults.total_searched} memórias analisadas)</span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {memoryTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="archived">Arquivadas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Memories List */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : filteredMemories?.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMemories.map(memory => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onClick={() => setSelectedMemory(memory)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Sparkles className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">Nenhuma memória encontrada</h3>
              <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
                As memórias são extraídas automaticamente de ganhos, perdas e comportamentos. 
                Você também pode criar memórias manualmente.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Criar Memória Manual
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Memory Detail Dialog */}
        <Dialog open={!!selectedMemory} onOpenChange={() => setSelectedMemory(null)}>
          <DialogContent className="max-w-2xl">
            {selectedMemory && (
              <MemoryDetailView 
                memory={selectedMemory}
                onValidate={() => handleValidate(selectedMemory)}
                onArchive={() => handleArchive(selectedMemory)}
                onClose={() => setSelectedMemory(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

// Create Memory Form Component
function CreateMemoryForm({ onSubmit }: { onSubmit: (data: Partial<Memory>) => void }) {
  const [formData, setFormData] = useState({
    memory_type: 'win_pattern' as MemoryType,
    title: '',
    content: '',
    keywords: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) {
      toast.error('Preencha título e conteúdo');
      return;
    }
    onSubmit({
      ...formData,
      keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean)
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Tipo de Memória</Label>
        <Select 
          value={formData.memory_type} 
          onValueChange={(v) => setFormData({ ...formData, memory_type: v as MemoryType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {memoryTypes.map(type => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Título</Label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Título descritivo da memória"
        />
      </div>

      <div className="space-y-2">
        <Label>Conteúdo</Label>
        <Textarea
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          placeholder="Descrição detalhada do aprendizado..."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Palavras-chave (separadas por vírgula)</Label>
        <Input
          value={formData.keywords}
          onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
          placeholder="preço, objeção, segmento..."
        />
      </div>

      <Button type="submit" className="w-full">
        Criar Memória
      </Button>
    </form>
  );
}

// Memory Detail View Component
function MemoryDetailView({ 
  memory, 
  onValidate, 
  onArchive,
  onClose 
}: { 
  memory: Memory;
  onValidate: () => void;
  onArchive: () => void;
  onClose: () => void;
}) {
  const typeConfig = memoryTypes.find(t => t.value === memory.memory_type);
  const Icon = typeConfig?.icon || Brain;

  return (
    <div>
      <DialogHeader>
        <div className="flex items-start gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            typeConfig?.color === 'text-green-600' && "bg-green-100",
            typeConfig?.color === 'text-red-600' && "bg-red-100",
            typeConfig?.color === 'text-orange-600' && "bg-orange-100",
            typeConfig?.color === 'text-purple-600' && "bg-purple-100",
            typeConfig?.color === 'text-amber-600' && "bg-amber-100",
            typeConfig?.color === 'text-blue-600' && "bg-blue-100"
          )}>
            <Icon className={cn("h-5 w-5", typeConfig?.color)} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary">
                {typeConfig?.label}
              </Badge>
              {memory.validated && (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Validado
                </Badge>
              )}
            </div>
            <DialogTitle>{memory.title}</DialogTitle>
          </div>
        </div>
      </DialogHeader>

      <div className="mt-4 space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-1">Conteúdo</h4>
          <p className="text-sm text-muted-foreground">{memory.content}</p>
        </div>

        {memory.keywords?.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-1">Palavras-chave</h4>
            <div className="flex flex-wrap gap-1">
              {memory.keywords.map((k, i) => (
                <Badge key={i} variant="outline">{k}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <h4 className="text-sm font-medium mb-1">Usos</h4>
            <p className="text-2xl font-bold">{memory.usage_count}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-1">Eficácia</h4>
            <p className="text-2xl font-bold">
              {memory.success_rate ? `${Math.round(memory.success_rate * 100)}%` : '-'}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-1">Confiança</h4>
            <p className="text-2xl font-bold">
              {Math.round(memory.confidence_score * 100)}%
            </p>
          </div>
        </div>

        {memory.source_metadata && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-medium mb-1">Fonte</h4>
            <p className="text-xs text-muted-foreground">
              {memory.source_metadata.account_name && (
                <>Empresa: {memory.source_metadata.account_name}<br /></>
              )}
              {memory.source_metadata.opportunity_title && (
                <>Deal: {memory.source_metadata.opportunity_title}<br /></>
              )}
              Extraído de: {memory.source_type}
              {memory.source_metadata.extraction_date && (
                <> em {new Date(memory.source_metadata.extraction_date).toLocaleDateString('pt-BR')}</>
              )}
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant={memory.validated ? "secondary" : "default"}
            className="flex-1"
            onClick={onValidate}
          >
            {memory.validated ? (
              <>
                <XCircle className="h-4 w-4 mr-1" />
                Remover Validação
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Validar Memória
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={onArchive}
          >
            {memory.status === 'active' ? 'Arquivar' : 'Reativar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
