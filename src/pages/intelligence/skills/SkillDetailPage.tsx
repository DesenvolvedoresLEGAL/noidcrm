import { useParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/ui/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSkill, useSkillRuns } from '@/hooks/intelligence/useSkills';
import { CATEGORY_LABEL, STATUS_LABEL, TYPE_LABEL } from '@/services/intelligence/skills';
import { PlayCircle, ArrowLeft } from 'lucide-react';

export default function SkillDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: skill, isLoading } = useSkill(id);
  const { data: runs = [] } = useSkillRuns(id);

  if (isLoading || !skill) return <PageContainer><Skeleton className="h-64" /></PageContainer>;

  return (
    <PageContainer>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/intelligence/skills')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{skill.name}</h1>
            <div className="text-xs text-muted-foreground">{skill.slug} · v{skill.version}</div>
          </div>
          <Badge>{STATUS_LABEL[skill.status]}</Badge>
          <Badge variant="outline">{CATEGORY_LABEL[skill.category]}</Badge>
          <Badge variant="outline">{TYPE_LABEL[skill.skill_type]}</Badge>
        </div>
        <Button onClick={() => navigate(`/app/intelligence/skills/${skill.id}/playground`)}>
          <PlayCircle className="h-4 w-4 mr-1" /> Testar no Playground
        </Button>
      </div>

      {skill.description && <p className="text-muted-foreground">{skill.description}</p>}

      <Tabs defaultValue="prompts">
        <TabsList>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="schemas">Schemas</TabsTrigger>
          <TabsTrigger value="guardrails">Guardrails</TabsTrigger>
          <TabsTrigger value="runs">Runs recentes</TabsTrigger>
        </TabsList>
        <TabsContent value="prompts">
          <Card>
            <CardHeader><CardTitle>System Prompt</CardTitle></CardHeader>
            <CardContent><pre className="whitespace-pre-wrap text-sm bg-muted p-3 rounded">{skill.system_prompt || '—'}</pre></CardContent>
          </Card>
          <Card className="mt-3">
            <CardHeader><CardTitle>Task Prompt</CardTitle></CardHeader>
            <CardContent><pre className="whitespace-pre-wrap text-sm bg-muted p-3 rounded">{skill.task_prompt || '—'}</pre></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="schemas">
          <Card>
            <CardHeader><CardTitle>Input Schema</CardTitle></CardHeader>
            <CardContent><pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(skill.input_schema, null, 2)}</pre></CardContent>
          </Card>
          <Card className="mt-3">
            <CardHeader><CardTitle>Output Schema</CardTitle></CardHeader>
            <CardContent><pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(skill.output_schema, null, 2)}</pre></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="guardrails">
          <Card>
            <CardContent className="pt-6"><pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(skill.guardrails, null, 2)}</pre></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="runs">
          <Card>
            <CardContent className="pt-6 space-y-2">
              {runs.length === 0 && <div className="text-muted-foreground text-sm">Nenhuma execução ainda.</div>}
              {runs.map(r => (
                <div key={r.id} className="border rounded p-2 text-xs flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.status === 'success' ? 'default' : 'destructive'}>{r.status}</Badge>
                      <span>{r.source_module ?? 'manual'}</span>
                      <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    {r.error_message && <div className="text-destructive mt-1">{r.error_message}</div>}
                  </div>
                  <div className="text-muted-foreground">{r.latency_ms ?? 0}ms · {r.model_used ?? '—'}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
