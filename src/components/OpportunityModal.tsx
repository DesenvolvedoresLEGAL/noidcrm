import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  XCircle,
  DollarSign,
  Calendar,
  MapPin,
  Building2,
  Clock,
  FileText,
} from 'lucide-react';
import { Opportunity, Pipeline } from '@/services/crm/types';

interface OpportunityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: any;
  pipeline: Pipeline;
  onWon: () => void;
  onLost: () => void;
}

export function OpportunityModal({
  open,
  onOpenChange,
  opportunity,
  pipeline,
  onWon,
  onLost,
}: OpportunityModalProps) {
  if (!opportunity) return null;

  const currentStageIndex = pipeline.stages.findIndex(
    (s) => s.id === opportunity.stage_id
  );
  const prob = (opportunity.prob || 0) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto animate-scale-in">
        <DialogHeader>
          <div className="flex flex-col md:flex-row items-start md:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-2">
                <DialogTitle className="text-xl md:text-2xl">
                  {opportunity.account_name || `Oportunidade ${opportunity.id}`}
                </DialogTitle>
                <Badge variant="secondary" className="text-xs md:text-sm">
                  {prob}%
                </Badge>
                <Badge className="bg-primary text-primary-foreground text-xs md:text-sm">
                  {opportunity.produto}
                </Badge>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                {pipeline.name} → {pipeline.stages[currentStageIndex]?.name || 'N/A'}
              </p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button
                variant="default"
                className="bg-green-600 hover:bg-green-700 flex-1 md:flex-none"
                onClick={onWon}
                size="sm"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Ganhou
              </Button>
              <Button
                variant="destructive"
                onClick={onLost}
                className="flex-1 md:flex-none"
                size="sm"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Perdeu
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Barra de Progresso de Etapas */}
        <div className="my-6">
          <div className="flex items-center justify-between">
            {pipeline.stages.map((stage, index) => (
              <div key={stage.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      index <= currentStageIndex
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {index < currentStageIndex ? '✓' : index + 1}
                  </div>
                  <span className="text-xs mt-1 text-center max-w-[100px] truncate">
                    {stage.name}
                  </span>
                </div>
                {index < pipeline.stages.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      index < currentStageIndex ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Abas de Conteúdo */}
        <Tabs defaultValue="detalhes" className="mt-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="notas">Notas</TabsTrigger>
            <TabsTrigger value="atividades">Atividades</TabsTrigger>
            <TabsTrigger value="propostas">Propostas</TabsTrigger>
            <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
          </TabsList>

          <TabsContent value="detalhes" className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Coluna Esquerda - Informações Principais */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="font-semibold mb-4">Informações da Oportunidade</h3>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">ID:</span>
                        <span className="text-sm font-medium">{opportunity.id}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Valor P&S:</span>
                        <span className="text-sm font-semibold text-primary">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(opportunity.valor_previsto || 0)}
                        </span>
                      </div>

                      {opportunity.meta?.mrr && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">MRR:</span>
                          <span className="text-sm font-semibold text-accent">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(opportunity.meta.mrr)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Previsão:</span>
                        <span className="text-sm">
                          {opportunity.close_date_prevista
                            ? new Date(opportunity.close_date_prevista).toLocaleDateString('pt-BR')
                            : 'Não definida'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Criada em:</span>
                        <span className="text-sm">
                          {new Date(opportunity.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      {opportunity.meta?.cidade && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Localização:</span>
                          <span className="text-sm">
                            {opportunity.meta.cidade}, {opportunity.meta.uf}
                          </span>
                        </div>
                      )}

                      {opportunity.meta?.origem && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Origem:</span>
                          <span className="text-sm">{opportunity.meta.origem}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Coluna Direita - Contato e Empresa */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="font-semibold mb-4">Empresa & Contato</h3>
                    
                    <div className="space-y-3">
                      {opportunity.account_name && (
                        <div>
                          <span className="text-sm text-muted-foreground">Empresa:</span>
                          <p className="text-sm font-medium">{opportunity.account_name}</p>
                        </div>
                      )}

                      {opportunity.contact_name && (
                        <div>
                          <span className="text-sm text-muted-foreground">Contato:</span>
                          <p className="text-sm font-medium">{opportunity.contact_name}</p>
                        </div>
                      )}

                      {opportunity.contact_email && (
                        <div>
                          <span className="text-sm text-muted-foreground">E-mail:</span>
                          <p className="text-sm">{opportunity.contact_email}</p>
                        </div>
                      )}

                      {opportunity.contact_phone && (
                        <div>
                          <span className="text-sm text-muted-foreground">Telefone:</span>
                          <p className="text-sm">{opportunity.contact_phone}</p>
                        </div>
                      )}

                      {opportunity.meta?.observacoes && (
                        <div>
                          <span className="text-sm text-muted-foreground">Observações:</span>
                          <p className="text-sm mt-1">{opportunity.meta.observacoes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  Histórico de atividades será implementado em breve.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notas">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  Editor de notas será implementado em breve.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="atividades">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  Lista de atividades será implementada em breve.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="propostas">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Propostas</h3>
                  <Button size="sm">+ Nova Proposta</Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Lista de propostas será implementada em breve.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="arquivos">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  Gerenciador de arquivos será implementado em breve.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
