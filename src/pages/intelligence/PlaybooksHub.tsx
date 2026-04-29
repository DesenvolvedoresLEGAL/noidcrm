import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, Plus, Search, LayoutGrid, List, Sparkles, 
  BookOpen
} from 'lucide-react';
import { 
  usePlaybooks, 
  useCreatePlaybook, 
  useUpdatePlaybook, 
  useTogglePlaybook,
  useDeployPlaybookVersion,
  useGeneratePlaybookFromWinLoss,
  type Playbook 
} from '@/hooks/usePlaybookSystem';
import { PlaybookCard } from '@/components/playbook/PlaybookCard';
import { PlaybookEditor } from '@/components/playbook/PlaybookEditor';
import { PlaybookVersionHistory } from '@/components/playbook/PlaybookVersionHistory';

const CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'prospecting', label: 'Prospecção' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'negotiation', label: 'Negociação' },
  { id: 'closing', label: 'Fechamento' },
];

export default function PlaybooksHub() {
  const { data: playbooks, isLoading } = usePlaybooks();
  const createMutation = useCreatePlaybook();
  const updateMutation = useUpdatePlaybook();
  const toggleMutation = useTogglePlaybook();
  const deployMutation = useDeployPlaybookVersion();
  const generateFromWinLoss = useGeneratePlaybookFromWinLoss();

  
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null);

  const filteredPlaybooks = playbooks?.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || p.category === category;
    return matchesSearch && matchesCategory;
  }) || [];

  const activePlaybooks = filteredPlaybooks.filter(p => p.is_active && !p.auto_disabled);
  const disabledPlaybooks = filteredPlaybooks.filter(p => !p.is_active || p.auto_disabled);

  const handleSavePlaybook = (data: Partial<Playbook>) => {
    if (data.id) {
      updateMutation.mutate(data as Playbook);
    } else {
      createMutation.mutate(data);
    }
    setEditingPlaybook(null);
  };

  const handleEdit = (playbook: Playbook) => {
    setEditingPlaybook(playbook);
    setEditorOpen(true);
  };

  const handleDeploy = (playbookId: string) => {
    deployMutation.mutate({ playbookId });
  };

  const handleViewVersions = (playbookId: string) => {
    setSelectedPlaybookId(playbookId);
    setVersionHistoryOpen(true);
  };

  const handleDuplicate = (playbook: Playbook) => {
    const { id, created_at, updated_at, usage_count, roi_score, ...rest } = playbook;
    createMutation.mutate({
      ...rest,
      name: `${playbook.name} (cópia)`,
    });
  };

  const handleToggle = (id: string, isActive: boolean) => {
    toggleMutation.mutate({ id, isActive });
  };

  const selectedPlaybook = playbooks?.find(p => p.id === selectedPlaybookId);

  // Stats
  const totalPlaybooks = playbooks?.length || 0;
  const activeCount = playbooks?.filter(p => p.is_active && !p.auto_disabled).length || 0;
  const autoDisabledCount = playbooks?.filter(p => p.auto_disabled).length || 0;
  const totalRevenue = playbooks?.reduce((sum, p) => sum + (p.total_revenue_generated || 0), 0) || 0;

  return (
    <Layout pageTitle="Playbooks">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <PageHeader
          icon={BookOpen}
          title="Playbooks"
          subtitle="Construa, execute e escale sua máquina de receita"
          badge={{ label: "Inteligência", icon: Sparkles }}
          variant="indigo"
          actions={
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => generateFromWinLoss.mutate({})}
                disabled={generateFromWinLoss.isPending}
              >
                {generateFromWinLoss.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Gerar com IA
              </Button>
              <Button onClick={() => {
                setEditingPlaybook(null);
                setEditorOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Playbook
              </Button>
            </div>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{totalPlaybooks}</div>
              <div className="text-sm text-muted-foreground">Total Playbooks</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-500">{activeCount}</div>
              <div className="text-sm text-muted-foreground">Ativos</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-destructive">{autoDisabledCount}</div>
              <div className="text-sm text-muted-foreground">Auto-desativados</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totalRevenue)}
              </div>
              <div className="text-sm text-muted-foreground">Revenue Total</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar playbooks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Tabs value={category} onValueChange={setCategory}>
            <TabsList>
              {CATEGORIES.map(cat => (
                <TabsTrigger key={cat.id} value={cat.id} className="text-xs sm:text-sm">
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPlaybooks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-muted-foreground mb-4">
                {search || category !== 'all' 
                  ? 'Nenhum playbook encontrado com os filtros aplicados'
                  : 'Você ainda não tem playbooks'}
              </div>
              <Button onClick={() => {
                setEditingPlaybook(null);
                setEditorOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Playbook
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {activePlaybooks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Playbooks Ativos</h2>
                  <Badge variant="secondary">{activePlaybooks.length}</Badge>
                </div>
                <div className={viewMode === 'grid' 
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  : "space-y-3"
                }>
                  {activePlaybooks.map(playbook => (
                    <PlaybookCard
                      key={playbook.id}
                      playbook={playbook}
                      onToggle={handleToggle}
                      onEdit={handleEdit}
                      onDeploy={handleDeploy}
                      onViewVersions={handleViewVersions}
                      onDuplicate={handleDuplicate}
                    />
                  ))}
                </div>
              </div>
            )}

            {disabledPlaybooks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-muted-foreground">
                    Playbooks Inativos / Auto-desativados
                  </h2>
                  <Badge variant="secondary">{disabledPlaybooks.length}</Badge>
                </div>
                <div className={viewMode === 'grid' 
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  : "space-y-3"
                }>
                  {disabledPlaybooks.map(playbook => (
                    <PlaybookCard
                      key={playbook.id}
                      playbook={playbook}
                      onToggle={handleToggle}
                      onEdit={handleEdit}
                      onDeploy={handleDeploy}
                      onViewVersions={handleViewVersions}
                      onDuplicate={handleDuplicate}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Editor Modal */}
        <PlaybookEditor
          playbook={editingPlaybook}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          onSave={handleSavePlaybook}
        />

        {/* Version History Modal */}
        <PlaybookVersionHistory
          playbookId={selectedPlaybookId}
          currentVersionId={selectedPlaybook?.current_version_id || null}
          open={versionHistoryOpen}
          onOpenChange={setVersionHistoryOpen}
        />
      </div>
    </Layout>
  );
}
