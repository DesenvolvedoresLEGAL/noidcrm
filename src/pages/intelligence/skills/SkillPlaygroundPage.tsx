import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/ui/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, PlayCircle } from 'lucide-react';
import { useSkill, useRunSkill } from '@/hooks/intelligence/useSkills';
import { toast } from 'sonner';

export default function SkillPlaygroundPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: skill, isLoading } = useSkill(id);
  const runMutation = useRunSkill();
  const [values, setValues] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);

  const props = useMemo(() => {
    const s = skill?.input_schema;
    if (!s || typeof s !== 'object' || s.type !== 'object') return [];
    const required: string[] = Array.isArray(s.required) ? s.required : [];
    return Object.entries<any>(s.properties || {}).map(([key, def]) => ({
      key, type: def.type, required: required.includes(key),
    }));
  }, [skill]);

  const run = async () => {
    if (!skill) return;
    try {
      const data = await runMutation.mutateAsync({
        skill_id: skill.id,
        context: values,
        source_module: 'playground',
        dry_run: true,
      });
      setResult(data);
      toast.success('Skill executada');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao executar');
    }
  };

  if (isLoading || !skill) return <PageContainer><Skeleton className="h-64" /></PageContainer>;

  return (
    <PageContainer>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/app/intelligence/skills/${skill.id}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Playground · {skill.name}</h1>
          <div className="text-xs text-muted-foreground">Não altera CRM. Runs marcadas como <Badge variant="outline" className="ml-1">playground</Badge></div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Contexto</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {props.map(p => (
              <div key={p.key} className="space-y-1">
                <Label>{p.key} {p.required && <span className="text-destructive">*</span>} <span className="text-xs text-muted-foreground">({p.type})</span></Label>
                {p.type === 'string' && p.key.match(/prompt|context|summary|hypothesis|body/i) ? (
                  <Textarea value={values[p.key] ?? ''} onChange={e => setValues(v => ({ ...v, [p.key]: e.target.value }))} />
                ) : (
                  <Input
                    type={p.type === 'number' || p.type === 'integer' ? 'number' : 'text'}
                    value={values[p.key] ?? ''}
                    onChange={e => {
                      const raw = e.target.value;
                      const val = (p.type === 'number' || p.type === 'integer') ? (raw === '' ? '' : Number(raw)) : raw;
                      setValues(v => ({ ...v, [p.key]: val }));
                    }}
                  />
                )}
              </div>
            ))}
            <Button onClick={run} disabled={runMutation.isPending}>
              <PlayCircle className="h-4 w-4 mr-1" /> {runMutation.isPending ? 'Executando…' : 'Executar skill'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Resultado</CardTitle></CardHeader>
          <CardContent>
            {!result && <div className="text-sm text-muted-foreground">Nenhum resultado ainda.</div>}
            {result && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={result.status === 'success' || result.status === 'playground' ? 'default' : 'destructive'}>{result.status}</Badge>
                  <span className="text-xs text-muted-foreground">{result.model_used} · {result.latency_ms}ms</span>
                </div>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(result.output, null, 2)}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
