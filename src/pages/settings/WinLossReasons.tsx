import { useEffect, useState } from 'react';
import { getLossCategoryLabel } from '@/utils/category-labels';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2, Trophy, XCircle, Sparkles } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  listLossReasons,
  deleteLossReason,
  toggleLossReasonStatus,
  seedPreSalesDisqualificationReasons,
  type LossReason,
} from '@/services/crm/loss-reasons';
import {
  listWinReasons as listAllWinReasons,
  deleteWinReason,
  updateWinReason,
  type WinReason,
} from '@/services/crm/win-reasons';
import { listPipelines, type Pipeline } from '@/services/crm/pipelines';
import { LossReasonModal } from '@/components/settings/LossReasonModal';
import { WinReasonModal } from '@/components/settings/WinReasonModal';

export default function WinLossReasons() {
  const [lossReasons, setLossReasons] = useState<LossReason[]>([]);
  const [winReasons, setWinReasons] = useState<WinReason[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPipeline, setSelectedPipeline] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [seeding, setSeeding] = useState(false);
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [isWinModalOpen, setIsWinModalOpen] = useState(false);
  const [editingLossReason, setEditingLossReason] = useState<LossReason | null>(null);
  const [editingWinReason, setEditingWinReason] = useState<WinReason | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('loss');
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [lossData, winData, pipelinesData] = await Promise.all([
        listLossReasons(),
        listAllWinReasons(),
        listPipelines(),
      ]);
      setLossReasons(lossData);
      setWinReasons(winData);
      setPipelines(pipelinesData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLoss = async (id: string) => {
    if (!confirm('Deseja realmente excluir este motivo de perda?')) return;

    try {
      await deleteLossReason(id);
      toast({
        title: 'Sucesso',
        description: 'Motivo de perda excluído',
      });
      loadData();
    } catch (error) {
      console.error('Error deleting loss reason:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir motivo de perda',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteWin = async (id: string) => {
    if (!confirm('Deseja realmente excluir este motivo de ganho?')) return;

    try {
      await deleteWinReason(id);
      toast({
        title: 'Sucesso',
        description: 'Motivo de ganho excluído',
      });
      loadData();
    } catch (error) {
      console.error('Error deleting win reason:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao excluir motivo de ganho',
        variant: 'destructive',
      });
    }
  };

  const handleToggleLossStatus = async (id: string, currentStatus: boolean) => {
    try {
      await toggleLossReasonStatus(id, !currentStatus);
      toast({
        title: 'Sucesso',
        description: 'Status atualizado',
      });
      loadData();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar status',
        variant: 'destructive',
      });
    }
  };

  const handleToggleWinStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateWinReason(id, { is_active: !currentStatus });
      toast({
        title: 'Sucesso',
        description: 'Status atualizado',
      });
      loadData();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar status',
        variant: 'destructive',
      });
    }
  };

  const handleEditLoss = (reason: LossReason) => {
    setEditingLossReason(reason);
    setIsLossModalOpen(true);
  };

  const handleEditWin = (reason: WinReason) => {
    setEditingWinReason(reason);
    setIsWinModalOpen(true);
  };

  const handleLossModalClose = () => {
    setIsLossModalOpen(false);
    setEditingLossReason(null);
    loadData();
  };

  const handleWinModalClose = () => {
    setIsWinModalOpen(false);
    setEditingWinReason(null);
    loadData();
  };

  const getPipelineNames = (pipelineIds: string[] | null | undefined) => {
    if (!pipelineIds || pipelineIds.length === 0) {
      return 'Todos os funis';
    }
    return pipelines
      .filter(p => pipelineIds.includes(p.id))
      .map(p => p.name)
      .join(', ');
  };

  const getAudienceLabel = (audience?: string) => {
    switch (audience) {
      case 'client': return 'Cliente';
      case 'seller': return 'Vendedor';
      case 'both': 
      default: return 'Ambos';
    }
  };

  const getAudienceVariant = (audience?: string): 'default' | 'secondary' | 'outline' => {
    switch (audience) {
      case 'client': return 'secondary';
      case 'seller': return 'default';
      default: return 'outline';
    }
  };

  const getCategoryLabel = getLossCategoryLabel;

  const filteredLossReasons = lossReasons.filter(reason => {
    const matchesSearch = reason.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPipeline = selectedPipeline === 'all' ||
      !reason.pipeline_ids ||
      reason.pipeline_ids.includes(selectedPipeline);
    const rType = (reason as any).reason_type || 'lost';
    const matchesType = selectedType === 'all' || rType === selectedType;
    return matchesSearch && matchesPipeline && matchesType;
  });

  const handleSeedPreSales = async () => {
    const qualPipelines = pipelines.filter((p) => (p as any).pipeline_type === 'qualification');
    if (qualPipelines.length === 0) {
      toast({
        title: 'Nenhum funil de PRÉ VENDAS',
        description: 'Crie um funil de qualificação antes de aplicar o template.',
        variant: 'destructive',
      });
      return;
    }
    const target =
      selectedPipeline !== 'all' &&
      qualPipelines.find((p) => p.id === selectedPipeline);
    const pipeline = target || qualPipelines[0];
    if (!confirm(`Aplicar template de motivos de Desqualificação ao funil "${pipeline.name}"?`)) return;
    try {
      setSeeding(true);
      const orgId = (pipeline as any).organization_id as string;
      const inserted = await seedPreSalesDisqualificationReasons(orgId, pipeline.id);
      toast({
        title: 'Template aplicado',
        description: `${inserted} motivos criados (existentes preservados).`,
      });
      loadData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message || 'Falha ao aplicar template', variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  const filteredWinReasons = winReasons
    .filter(reason => {
      const matchesSearch = reason.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPipeline = selectedPipeline === 'all' ||
        !reason.pipeline_ids ||
        reason.pipeline_ids.includes(selectedPipeline);
      return matchesSearch && matchesPipeline;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Motivos de Ganho/Perda</h1>
            <p className="text-muted-foreground">
              Gerencie os motivos de ganho e perda de oportunidades
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSeedPreSales}
              disabled={seeding}
              title="Cria os motivos padrão de desqualificação para PRÉ VENDAS (idempotente)"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {seeding ? 'Aplicando...' : 'Aplicar template PRÉ VENDAS'}
            </Button>
            <Button onClick={() => activeTab === 'loss' ? setIsLossModalOpen(true) : setIsWinModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar motivo
            </Button>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar motivos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por funil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os funis</SelectItem>
              {pipelines.map((pipeline) => (
                <SelectItem key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="lost">Motivo de Perda</SelectItem>
              <SelectItem value="disqualification">Motivo de Desqualificação</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="loss" className="gap-2">
              <XCircle className="h-4 w-4" />
              Motivos de Perda
            </TabsTrigger>
            <TabsTrigger value="win" className="gap-2">
              <Trophy className="h-4 w-4" />
              Motivos de Ganho
            </TabsTrigger>
          </TabsList>

          <TabsContent value="loss" className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>MOTIVO</TableHead>
                     <TableHead>TIPO</TableHead>
                     <TableHead>CATEGORIA</TableHead>
                     <TableHead>VISIBILIDADE</TableHead>
                     <TableHead>FUNIL</TableHead>
                     <TableHead>STATUS</TableHead>
                     <TableHead className="text-right">AÇÕES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                     <TableCell colSpan={7} className="text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredLossReasons.length === 0 ? (
                    <TableRow>
                     <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nenhum motivo encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLossReasons.map((reason) => (
                      <TableRow key={reason.id}>
                        <TableCell className="font-medium">{reason.name}</TableCell>
                        <TableCell>
                          <Badge variant={((reason as any).reason_type === 'disqualification') ? 'destructive' : 'secondary'}>
                            {((reason as any).reason_type === 'disqualification') ? 'Desqualificação' : 'Perda'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{getCategoryLabel((reason as any).category)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getAudienceVariant((reason as any).audience)}>
                            {getAudienceLabel((reason as any).audience)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getPipelineNames(reason.pipeline_ids)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={reason.is_active}
                            onCheckedChange={() => handleToggleLossStatus(reason.id, reason.is_active)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditLoss(reason)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteLoss(reason.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="win" className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>MOTIVO</TableHead>
                     <TableHead>VISIBILIDADE</TableHead>
                     <TableHead>FUNIL</TableHead>
                     <TableHead>STATUS</TableHead>
                     <TableHead className="text-right">AÇÕES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredWinReasons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum motivo encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredWinReasons.map((reason) => (
                      <TableRow key={reason.id}>
                        <TableCell className="font-medium">{reason.name}</TableCell>
                        <TableCell>
                          <Badge variant={getAudienceVariant(reason.audience)}>
                            {getAudienceLabel(reason.audience)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getPipelineNames(reason.pipeline_ids)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={reason.is_active}
                            onCheckedChange={() => handleToggleWinStatus(reason.id, reason.is_active)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditWin(reason)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteWin(reason.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <LossReasonModal
        open={isLossModalOpen}
        onClose={handleLossModalClose}
        reason={editingLossReason}
        pipelines={pipelines}
      />

      <WinReasonModal
        open={isWinModalOpen}
        onClose={handleWinModalClose}
        reason={editingWinReason}
        pipelines={pipelines}
      />
    </Layout>
  );
}
