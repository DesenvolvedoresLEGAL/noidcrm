import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookTemplate, Plus, Trash2, Star, Loader2, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplate,
  ProposalTemplate,
} from '@/services/crm/proposal-templates';
import { toast } from 'sonner';
import { proposalKeys } from '@/lib/query-keys';

interface ProposalTemplatesManagerProps {
  proposalId?: string;
  onApplyTemplate?: (templateId: string) => void;
}

export function ProposalTemplatesManager({
  proposalId,
  onApplyTemplate,
}: ProposalTemplatesManagerProps) {
  const [open, setOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState<Partial<ProposalTemplate>>({
    name: '',
    description: '',
    introduction: '',
    terms: '',
    notes: '',
  });

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['proposal-templates'],
    queryFn: listTemplates,
    // SPRINT PERF 0.4 — catálogo de configuração. Mutations locais invalidam a key.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      toast.success('Template criado!');
      queryClient.invalidateQueries({ queryKey: ['proposal-templates'] });
      setCreateModalOpen(false);
      setNewTemplate({
        name: '',
        description: '',
        introduction: '',
        terms: '',
        notes: '',
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar template');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      toast.success('Template excluído!');
      queryClient.invalidateQueries({ queryKey: ['proposal-templates'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir template');
    },
  });

  const applyMutation = useMutation({
    mutationFn: ({ proposalId, templateId }: { proposalId: string; templateId: string }) =>
      applyTemplate(proposalId, templateId),
    onSuccess: () => {
      toast.success('Template aplicado!');
      queryClient.invalidateQueries({ queryKey: ['proposal'] });
      onApplyTemplate?.(proposalId!);
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao aplicar template');
    },
  });

  const setAsDefaultMutation = useMutation({
    mutationFn: (templateId: string) =>
      updateTemplate(templateId, { is_default: true }),
    onSuccess: () => {
      toast.success('Template definido como padrão!');
      queryClient.invalidateQueries({ queryKey: ['proposal-templates'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao definir template padrão');
    },
  });

  const handleCreateTemplate = () => {
    if (!newTemplate.name?.trim()) {
      toast.error('Nome do template é obrigatório');
      return;
    }
    createMutation.mutate(newTemplate as Omit<ProposalTemplate, 'id' | 'created_at' | 'updated_at'>);
  };

  const handleApplyTemplate = (templateId: string) => {
    if (!proposalId) {
      toast.error('Proposta não especificada');
      return;
    }
    applyMutation.mutate({ proposalId, templateId });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <BookTemplate className="h-4 w-4 mr-2" />
            Templates
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Templates de Proposta</DialogTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    navigate('/app/settings/proposal-layouts');
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Modelos Visuais
                </Button>
                <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Template
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Template</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="p-3 bg-muted rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground">
                        💡 <strong>Dica:</strong> Use variáveis dinâmicas como <code className="text-xs bg-background px-1 py-0.5 rounded">{'{{cliente_nome}}'}</code>, <code className="text-xs bg-background px-1 py-0.5 rounded">{'{{org_nome}}'}</code>, <code className="text-xs bg-background px-1 py-0.5 rounded">{'{{proposta_total}}'}</code> para personalizar automaticamente suas propostas.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Nome do Template *</Label>
                      <Input
                        value={newTemplate.name}
                        onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                        placeholder="Ex: Template Padrão B2B"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        value={newTemplate.description || ''}
                        onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                        placeholder="Descreva o template..."
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Introdução Padrão</Label>
                      <Textarea
                        value={newTemplate.introduction || ''}
                        onChange={(e) => setNewTemplate({ ...newTemplate, introduction: e.target.value })}
                        placeholder="Texto padrão de introdução..."
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Termos e Condições Padrão</Label>
                      <Textarea
                        value={newTemplate.terms || ''}
                        onChange={(e) => setNewTemplate({ ...newTemplate, terms: e.target.value })}
                        placeholder="Termos e condições padrão..."
                        rows={4}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setCreateModalOpen(false)}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleCreateTemplate}
                        disabled={createMutation.isPending}
                        className="flex-1"
                      >
                        {createMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Criar Template'
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
                </Dialog>
              </div>
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : templates && templates.length > 0 ? (
            <div className="grid gap-3">
              {templates.map((template) => (
                <Card key={template.id} className="hover:border-primary transition-colors">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold truncate">{template.name}</h4>
                          {template.is_default && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-current" />
                              Padrão
                            </Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {template.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {!template.is_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAsDefaultMutation.mutate(template.id!)}
                            title="Definir como padrão"
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        {proposalId && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApplyTemplate(template.id!)}
                            disabled={applyMutation.isPending}
                          >
                            Aplicar
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(template.id!)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BookTemplate className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum template criado ainda.</p>
              <p className="text-sm">Crie templates para reutilizar em suas propostas.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
