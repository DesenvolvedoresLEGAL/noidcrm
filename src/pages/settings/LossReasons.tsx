import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import {
  listLossReasons,
  deleteLossReason,
  toggleLossReasonStatus,
  type LossReason,
} from '@/services/crm/loss-reasons';
import { listPipelines, type Pipeline } from '@/services/crm/pipelines';
import { LossReasonModal } from '@/components/settings/LossReasonModal';

export default function LossReasons() {
  const [lossReasons, setLossReasons] = useState<LossReason[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPipeline, setSelectedPipeline] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReason, setEditingReason] = useState<LossReason | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reasonsData, pipelinesData] = await Promise.all([
        listLossReasons(),
        listPipelines(),
      ]);
      setLossReasons(reasonsData);
      setPipelines(pipelinesData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar motivos de perda',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
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

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
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

  const handleEdit = (reason: LossReason) => {
    setEditingReason(reason);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingReason(null);
    loadData();
  };

  const getPipelineNames = (pipelineIds: string[] | null) => {
    if (!pipelineIds || pipelineIds.length === 0) {
      return 'Todos os funis';
    }
    return pipelines
      .filter(p => pipelineIds.includes(p.id))
      .map(p => p.name)
      .join(', ');
  };

  const filteredReasons = lossReasons.filter(reason => {
    const matchesSearch = reason.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPipeline = selectedPipeline === 'all' ||
      !reason.pipeline_ids ||
      reason.pipeline_ids.includes(selectedPipeline);
    return matchesSearch && matchesPipeline;
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Motivos de Perda</h1>
            <p className="text-muted-foreground">
              Gerencie os motivos de perda de oportunidades
            </p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar motivo
          </Button>
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
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MOTIVO</TableHead>
                <TableHead>FUNIL</TableHead>
                <TableHead>STATUS</TableHead>
                <TableHead className="text-right">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredReasons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum motivo encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredReasons.map((reason) => (
                  <TableRow key={reason.id}>
                    <TableCell className="font-medium">{reason.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getPipelineNames(reason.pipeline_ids)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={reason.is_active}
                        onCheckedChange={() => handleToggleStatus(reason.id, reason.is_active)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(reason)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(reason.id)}
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
      </div>

      <LossReasonModal
        open={isModalOpen}
        onClose={handleModalClose}
        reason={editingReason}
        pipelines={pipelines}
      />
    </Layout>
  );
}
