import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  UserPlus, 
  Upload, 
  Zap, 
  Building2, 
  Mail, 
  Phone, 
  Globe,
  TrendingUp,
  Target,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useIngestLead } from '@/hooks/useLeadIngestion';
import { createLeadFromForm, previewLeadRouting } from '@/services/crm/lead-ingestion';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function LeadIngestionPanel() {
  const { organization } = useCurrentUser();
  const ingestMutation = useIngestLead();
  
  const [formData, setFormData] = useState({
    empresa: '',
    cnpj: '',
    website: '',
    telefone: '',
    segmento: '',
    contato_nome: '',
    contato_email: '',
    contato_telefone: '',
    contato_cargo: '',
    origem: 'manual',
    valor_estimado: 0,
    produto: '',
  });

  const [preview, setPreview] = useState<{
    estimated_grade: string;
    estimated_pipeline: string;
    factors: string[];
  } | null>(null);

  const [lastResult, setLastResult] = useState<{
    lead_grade: string;
    fit_score: number;
    intent_score: number;
    pipeline_type: string;
  } | null>(null);

  const handleChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePreview = async () => {
    if (!organization?.id) return;
    const lead = createLeadFromForm(formData);
    const result = await previewLeadRouting(lead, organization.id);
    setPreview(result);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const lead = createLeadFromForm(formData);
    const result = await ingestMutation.mutateAsync(lead);
    
    setLastResult({
      lead_grade: result.lead_grade,
      fit_score: result.fit_score,
      intent_score: result.intent_score,
      pipeline_type: result.pipeline_type,
    });

    // Reset form
    setFormData({
      empresa: '',
      cnpj: '',
      website: '',
      telefone: '',
      segmento: '',
      contato_nome: '',
      contato_email: '',
      contato_telefone: '',
      contato_cargo: '',
      origem: 'manual',
      valor_estimado: 0,
      produto: '',
    });
    setPreview(null);
  };

  const getGradeBadgeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'B': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'C': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'D': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'F': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Lead Ingestion Engine</h2>
          <p className="text-sm text-muted-foreground">
            Auto-classificação, routing inteligente e sequências autônomas
          </p>
        </div>
      </div>

      <Tabs defaultValue="manual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="manual" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Manual
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-2">
            <Globe className="h-4 w-4" />
            API
          </TabsTrigger>
          <TabsTrigger value="bulk" className="gap-2">
            <Upload className="h-4 w-4" />
            Bulk Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Form */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Dados do Lead</CardTitle>
                <CardDescription>
                  Preencha os dados e o sistema irá classificar automaticamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Company Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      Empresa
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nome da Empresa *</Label>
                        <Input
                          value={formData.empresa}
                          onChange={(e) => handleChange('empresa', e.target.value)}
                          placeholder="Nome da empresa"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CNPJ</Label>
                        <Input
                          value={formData.cnpj}
                          onChange={(e) => handleChange('cnpj', e.target.value)}
                          placeholder="00.000.000/0001-00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Website</Label>
                        <Input
                          value={formData.website}
                          onChange={(e) => handleChange('website', e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Segmento</Label>
                        <Input
                          value={formData.segmento}
                          onChange={(e) => handleChange('segmento', e.target.value)}
                          placeholder="Ex: Tecnologia, Varejo..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      Contato
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nome do Contato</Label>
                        <Input
                          value={formData.contato_nome}
                          onChange={(e) => handleChange('contato_nome', e.target.value)}
                          placeholder="Nome completo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={formData.contato_email}
                          onChange={(e) => handleChange('contato_email', e.target.value)}
                          placeholder="email@empresa.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input
                          value={formData.contato_telefone}
                          onChange={(e) => handleChange('contato_telefone', e.target.value)}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cargo</Label>
                        <Input
                          value={formData.contato_cargo}
                          onChange={(e) => handleChange('contato_cargo', e.target.value)}
                          placeholder="Ex: Diretor, Gerente..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Opportunity Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      Oportunidade
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Valor Estimado</Label>
                        <Input
                          type="number"
                          value={formData.valor_estimado || ''}
                          onChange={(e) => handleChange('valor_estimado', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Produto/Serviço</Label>
                        <Input
                          value={formData.produto}
                          onChange={(e) => handleChange('produto', e.target.value)}
                          placeholder="Interesse em..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePreview}
                      disabled={!formData.empresa}
                    >
                      <Target className="h-4 w-4 mr-2" />
                      Preview Routing
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={ingestMutation.isPending || !formData.empresa}
                    >
                      {ingestMutation.isPending ? (
                        'Processando...'
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Criar Lead
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Preview/Result Panel */}
            <div className="space-y-4">
              {preview && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Preview do Routing
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Grade Estimado</span>
                      <Badge className={getGradeBadgeColor(preview.estimated_grade)}>
                        Grade {preview.estimated_grade}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pipeline</span>
                      <span className="text-sm font-medium">{preview.estimated_pipeline}</span>
                    </div>
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">Fatores</span>
                      <div className="space-y-1">
                        {preview.factors.map((factor, i) => (
                          <div key={i} className="text-xs flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            {factor}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {lastResult && (
                <Card className="border-emerald-500/30 bg-emerald-500/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-emerald-500">
                      <CheckCircle2 className="h-4 w-4" />
                      Lead Criado
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Grade</span>
                      <Badge className={getGradeBadgeColor(lastResult.lead_grade)}>
                        Grade {lastResult.lead_grade}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Fit Score</span>
                      <span className="text-sm font-medium">{lastResult.fit_score}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Intent Score</span>
                      <span className="text-sm font-medium">{lastResult.intent_score}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pipeline</span>
                      <span className="text-sm font-medium capitalize">{lastResult.pipeline_type}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Info Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Como Funciona</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium">
                        1
                      </div>
                      <div>
                        <p className="font-medium">Auto-cria Conta e Contato</p>
                        <p className="text-muted-foreground text-xs">Se não existirem no sistema</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium">
                        2
                      </div>
                      <div>
                        <p className="font-medium">Calcula Scores</p>
                        <p className="text-muted-foreground text-xs">Fit Score e Intent Score automáticos</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium">
                        3
                      </div>
                      <div>
                        <p className="font-medium">Routing Inteligente</p>
                        <p className="text-muted-foreground text-xs">A/B → Top performers, C/D/F → Nutrição</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium">
                        4
                      </div>
                      <div>
                        <p className="font-medium">Dispara Workflows</p>
                        <p className="text-muted-foreground text-xs">Notifica vendedor, inicia sequências</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API Endpoint</CardTitle>
              <CardDescription>
                Use este endpoint para integrar com outras ferramentas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted font-mono text-sm">
                <p className="text-muted-foreground mb-2">POST</p>
                <p className="break-all">
                  https://urihdqturaebhiefwjnw.supabase.co/functions/v1/ingest-lead
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Body (JSON):</p>
                <pre className="p-4 rounded-lg bg-muted text-xs overflow-auto">
{`{
  "organization_id": "uuid",
  "lead": {
    "razao_social": "Nome da Empresa",
    "cnpj": "00000000000000",
    "contact_nome": "João Silva",
    "contact_email": "joao@empresa.com",
    "valor_estimado": 10000,
    "origem": "website"
  }
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Importação em Massa</CardTitle>
              <CardDescription>
                Em breve: Upload de CSV/Excel para importar múltiplos leads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Funcionalidade em desenvolvimento
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
