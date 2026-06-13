import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SettingsGate } from '@/components/SettingsGate';
import {
  useActiveQualificationFramework,
  useQualificationFrameworkBundle,
  useQualificationFrameworks,
} from '@/hooks/useQualificationFramework';
import {
  applyLegalTemplate,
  setFrameworkActive,
  updateAutomation,
  updateBlockingRule,
  updateCriterion,
  updateFramework,
  updateReason,
} from '@/services/qualification/frameworksService';
import { ArrowLeft, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

function ScorePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

export default function QualificationFrameworkPage() {
  return (
    <SettingsGate requiredLevel="full">
      <QualificationFrameworkPageInner />
    </SettingsGate>
  );
}

function QualificationFrameworkPageInner() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: frameworks = [], isLoading: loadingList } = useQualificationFrameworks();
  const { data: active } = useActiveQualificationFramework();

  const selectedId = active?.id ?? frameworks[0]?.id;
  const { data: bundle, isLoading: loadingBundle } =
    useQualificationFrameworkBundle(selectedId);

  const [applying, setApplying] = useState(false);
  const [confirmTemplateOpen, setConfirmTemplateOpen] = useState(false);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['qualification-frameworks'] });
    qc.invalidateQueries({ queryKey: ['qualification-framework', 'active'] });
    qc.invalidateQueries({ queryKey: ['qualification-framework-bundle'] });
  };

  const handleApplyTemplate = async () => {
    setApplying(true);
    try {
      await applyLegalTemplate();
      toast.success('Template LEGAL aplicado com sucesso');
      invalidateAll();
    } catch (e: any) {
      toast.error(`Falha ao aplicar template: ${e?.message ?? 'erro desconhecido'}`);
    } finally {
      setApplying(false);
      setConfirmTemplateOpen(false);
    }
  };

  if (loadingList) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // No framework yet — only Templates tab makes sense
  if (frameworks.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader navigate={navigate} />
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma régua configurada</CardTitle>
            <CardDescription>
              Aplique um template para começar. Você poderá editar critérios, pesos, campos,
              classificações, bloqueios e motivos depois.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TemplateCard
              applying={applying}
              onApply={() => setConfirmTemplateOpen(true)}
            />
          </CardContent>
        </Card>

        <ConfirmTemplateDialog
          open={confirmTemplateOpen}
          onOpenChange={setConfirmTemplateOpen}
          applying={applying}
          onConfirm={handleApplyTemplate}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader navigate={navigate} />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="criteria">Critérios</TabsTrigger>
          <TabsTrigger value="fields">Campos Obrigatórios</TabsTrigger>
          <TabsTrigger value="ranges">Classificações</TabsTrigger>
          <TabsTrigger value="blocking">Regras de Bloqueio</TabsTrigger>
          <TabsTrigger value="reasons">Motivos de Desqualificação</TabsTrigger>
          <TabsTrigger value="automations">Automações</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {loadingBundle || !bundle ? (
          <div className="flex h-48 items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <TabsContent value="overview">
              <OverviewTab
                bundle={bundle}
                onChanged={invalidateAll}
                onApplyTemplate={() => setConfirmTemplateOpen(true)}
              />
            </TabsContent>
            <TabsContent value="criteria">
              <CriteriaTab bundle={bundle} onChanged={invalidateAll} />
            </TabsContent>
            <TabsContent value="fields">
              <FieldsTab bundle={bundle} />
            </TabsContent>
            <TabsContent value="ranges">
              <RangesTab bundle={bundle} />
            </TabsContent>
            <TabsContent value="blocking">
              <BlockingTab bundle={bundle} onChanged={invalidateAll} />
            </TabsContent>
            <TabsContent value="reasons">
              <ReasonsTab bundle={bundle} onChanged={invalidateAll} />
            </TabsContent>
            <TabsContent value="automations">
              <AutomationsTab bundle={bundle} onChanged={invalidateAll} />
            </TabsContent>
            <TabsContent value="templates">
              <TemplateCard
                applying={applying}
                onApply={() => setConfirmTemplateOpen(true)}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      <ConfirmTemplateDialog
        open={confirmTemplateOpen}
        onOpenChange={setConfirmTemplateOpen}
        applying={applying}
        onConfirm={handleApplyTemplate}
      />
    </div>
  );
}

function PageHeader({ navigate }: { navigate: (to: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/app/settings')}
          className="-ml-2 mb-2 gap-2 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Configurações
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Régua de Qualificação</h1>
        <p className="text-muted-foreground">
          Configure critérios, pesos, campos obrigatórios, score comercial e regras de
          passagem entre funis.
        </p>
      </div>
    </div>
  );
}

function TemplateCard({
  applying,
  onApply,
}: {
  applying: boolean;
  onApply: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>LEGAL Eventos e Conectividade</CardTitle>
            </div>
            <CardDescription className="mt-2">
              Régua de qualificação para operações comerciais de eventos, conectividade
              temporária, internet para stands, ativações, credenciamento e operações em
              pavilhões.
            </CardDescription>
          </div>
          <Button onClick={onApply} disabled={applying}>
            {applying ? 'Aplicando...' : 'Aplicar template'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <ul className="list-disc space-y-1 pl-5">
          <li>7 critérios com pesos somando 100</li>
          <li>14 campos obrigatórios configurados</li>
          <li>5 faixas de classificação (Frio → SQL prioritário)</li>
          <li>1 regra de bloqueio (Pré-vendas → Vendas)</li>
          <li>19 motivos de desqualificação categorizados</li>
          <li>Automação padrão de desqualificação com Remarketing</li>
        </ul>
      </CardContent>
    </Card>
  );
}

function ConfirmTemplateDialog({
  open,
  onOpenChange,
  applying,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  applying: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Aplicar template LEGAL?</AlertDialogTitle>
          <AlertDialogDescription>
            Essa ação criará a régua padrão da LEGAL com critérios, pesos, campos
            obrigatórios, classificações, bloqueios e motivos de desqualificação. Se já
            existir um template LEGAL aplicado, ele será substituído. Você poderá editar
            tudo depois.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={applying}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={applying}>
            {applying ? 'Aplicando...' : 'Aplicar template'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function OverviewTab({
  bundle,
  onChanged,
  onApplyTemplate,
}: {
  bundle: NonNullable<ReturnType<typeof useQualificationFrameworkBundle>['data']>;
  onChanged: () => void;
  onApplyTemplate: () => void;
}) {
  const fw = bundle.framework;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(fw.name);
  const [description, setDescription] = useState(fw.description ?? '');
  const [minScore, setMinScore] = useState(fw.minimum_score_to_advance);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateFramework(fw.id, {
        name,
        description,
        minimum_score_to_advance: Number(minScore) || 0,
      });
      toast.success('Régua atualizada');
      setEditing(false);
      onChanged();
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e?.message ?? 'erro'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      await setFrameworkActive(fw.id, !fw.is_active);
      toast.success(fw.is_active ? 'Régua desativada' : 'Régua ativada');
      onChanged();
    } catch (e: any) {
      toast.error(`Falha ao alterar status: ${e?.message ?? 'erro'}`);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{fw.name}</CardTitle>
            <Badge variant={fw.is_active ? 'default' : 'secondary'}>
              {fw.is_active ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
          <CardDescription>{fw.description || '—'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {editing ? (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="max-w-xs">
                <Label>Score mínimo para avanço</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Stat label="Score mínimo" value={`${fw.minimum_score_to_advance}/100`} />
              <Stat label="Critérios" value={String(bundle.criteria.length)} />
              <Stat label="Campos" value={String(bundle.fields.length)} />
              <Stat label="Classificações" value={String(bundle.ranges.length)} />
              <Stat label="Regras bloqueio" value={String(bundle.blockingRules.length)} />
              <Stat label="Motivos desqualif." value={String(bundle.reasons.length)} />
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Última atualização: {new Date(fw.updated_at).toLocaleString('pt-BR')}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button className="w-full" variant="outline" onClick={() => setEditing(true)}>
            Editar régua
          </Button>
          <Button className="w-full" variant="outline" onClick={handleToggleActive}>
            {fw.is_active ? 'Desativar régua' : 'Ativar régua'}
          </Button>
          <Button className="w-full" variant="outline" onClick={onApplyTemplate}>
            Aplicar template
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function CriteriaTab({
  bundle,
  onChanged,
}: {
  bundle: NonNullable<ReturnType<typeof useQualificationFrameworkBundle>['data']>;
  onChanged: () => void;
}) {
  const total = bundle.criteria
    .filter((c) => c.is_active)
    .reduce((s, c) => s + (c.weight ?? 0), 0);

  const onWeightChange = async (id: string, weight: number) => {
    try {
      await updateCriterion(id, { weight });
      onChanged();
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? 'erro'}`);
    }
  };

  const onToggle = async (id: string, isActive: boolean) => {
    try {
      await updateCriterion(id, { is_active: isActive });
      onChanged();
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? 'erro'}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Critérios</CardTitle>
        <CardDescription>
          Pesos dos critérios ativos somam{' '}
          <strong className={total === 100 ? 'text-emerald-600' : 'text-amber-600'}>
            {total}
          </strong>{' '}
          de 100.{' '}
          {total !== 100 && (
            <span className="text-amber-600">
              <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
              Atenção: o recomendado é somar 100.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Critério</TableHead>
              <TableHead className="w-32">Peso</TableHead>
              <TableHead className="w-24">Ativo</TableHead>
              <TableHead className="w-24">Obrig.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bundle.criteria.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-medium">{c.name}</div>
                  {c.description && (
                    <div className="text-xs text-muted-foreground">{c.description}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={c.weight}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== c.weight) onWeightChange(c.id, v);
                    }}
                    className="w-24"
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={(v) => onToggle(c.id, v)}
                  />
                </TableCell>
                <TableCell>
                  {c.is_required ? (
                    <Badge variant="secondary">sim</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function FieldsTab({
  bundle,
}: {
  bundle: NonNullable<ReturnType<typeof useQualificationFrameworkBundle>['data']>;
}) {
  return (
    <div className="space-y-4">
      {bundle.criteria.map((c) => {
        const fields = bundle.fields.filter((f) => f.criterion_id === c.id);
        if (fields.length === 0) return null;
        return (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="text-base">{c.name}</CardTitle>
              <CardDescription>
                Peso do critério: {c.weight} · {fields.length} campo(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campo</TableHead>
                    <TableHead className="w-20">Pontos</TableHead>
                    <TableHead className="w-24">Score</TableHead>
                    <TableHead className="w-24">Avanço</TableHead>
                    <TableHead>Valores inválidos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <div className="font-medium">{f.field_label}</div>
                        <div className="text-xs text-muted-foreground">
                          <ScorePill>{f.field_source}</ScorePill>{' '}
                          <code className="ml-1 text-[10px]">{f.field_key}</code>{' '}
                          · {f.field_type}
                        </div>
                      </TableCell>
                      <TableCell>{f.points}</TableCell>
                      <TableCell>
                        {f.is_required_for_score ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {f.is_required_for_advance ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {f.invalid_values?.length ? f.invalid_values.join(', ') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RangesTab({
  bundle,
}: {
  bundle: NonNullable<ReturnType<typeof useQualificationFrameworkBundle>['data']>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Classificações</CardTitle>
        <CardDescription>Faixas de score e regra associada.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Faixa</TableHead>
              <TableHead>Classificação</TableHead>
              <TableHead>SQL</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Regra</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bundle.ranges.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">
                  {r.min_score}–{r.max_score}
                </TableCell>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell>{r.is_sql ? 'Sim' : '—'}</TableCell>
                <TableCell>{r.is_priority ? 'Sim' : '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.description || '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BlockingTab({
  bundle,
  onChanged,
}: {
  bundle: NonNullable<ReturnType<typeof useQualificationFrameworkBundle>['data']>;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-3">
      {bundle.blockingRules.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma regra de bloqueio configurada.
          </CardContent>
        </Card>
      )}
      {bundle.blockingRules.map((r) => (
        <Card key={r.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{r.action_label}</CardTitle>
                <CardDescription className="font-mono text-xs">
                  {r.action_key}
                </CardDescription>
              </div>
              <Switch
                checked={r.is_active}
                onCheckedChange={async (v) => {
                  await updateBlockingRule(r.id, { is_active: v });
                  onChanged();
                }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <strong>Score mínimo:</strong> {r.minimum_score ?? '—'}
            </div>
            <div>
              <strong>Exige checklist obrigatório completo:</strong>{' '}
              {r.require_all_required_fields ? 'sim' : 'não'}
            </div>
            <div>
              <strong>Exige permissão real para proposta:</strong>{' '}
              {r.require_valid_proposal_permission ? 'sim' : 'não'}
            </div>
            {r.block_message_title && (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="font-medium">{r.block_message_title}</div>
                <div className="text-muted-foreground">{r.block_message_body}</div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ReasonsTab({
  bundle,
  onChanged,
}: {
  bundle: NonNullable<ReturnType<typeof useQualificationFrameworkBundle>['data']>;
  onChanged: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Motivos de Desqualificação</CardTitle>
        <CardDescription>
          Aparecem no botão "Perdeu" das oportunidades vinculadas a esta régua.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Motivo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Accountability</TableHead>
              <TableHead className="w-32">Remarketing</TableHead>
              <TableHead className="w-24">Ativo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bundle.reasons.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.reason_label}</div>
                  <code className="text-[10px] text-muted-foreground">{r.reason_key}</code>
                </TableCell>
                <TableCell className="text-sm">{r.category || '—'}</TableCell>
                <TableCell className="text-sm capitalize">
                  {r.accountability || '—'}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={r.send_to_remarketing_default}
                    onCheckedChange={async (v) => {
                      await updateReason(r.id, { send_to_remarketing_default: v });
                      onChanged();
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={r.is_active}
                    onCheckedChange={async (v) => {
                      await updateReason(r.id, { is_active: v });
                      onChanged();
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AutomationsTab({
  bundle,
  onChanged,
}: {
  bundle: NonNullable<ReturnType<typeof useQualificationFrameworkBundle>['data']>;
  onChanged: () => void;
}) {
  const triggerLabels: Record<string, string> = {
    on_disqualify: 'Ao desqualificar lead',
    on_reach_minimum_score: 'Ao atingir score mínimo',
    on_below_minimum_score: 'Ao ficar abaixo do score mínimo',
    on_classification_change: 'Ao mudar de classificação',
  };
  return (
    <div className="space-y-3">
      {bundle.automations.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma automação configurada.
          </CardContent>
        </Card>
      )}
      {bundle.automations.map((a) => (
        <Card key={a.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{a.name}</CardTitle>
                <CardDescription>
                  {triggerLabels[a.trigger_key] ?? a.trigger_key}
                </CardDescription>
              </div>
              <Switch
                checked={a.is_active}
                onCheckedChange={async (v) => {
                  await updateAutomation(a.id, { is_active: v });
                  onChanged();
                }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {a.description && <p className="text-muted-foreground">{a.description}</p>}
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(a.config, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
