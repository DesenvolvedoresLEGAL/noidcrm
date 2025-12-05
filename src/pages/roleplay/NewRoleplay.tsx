import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getCurrentSeller, listICPs, listArchetypes, listRubrics } from '@/services/roleplay/sellers';
import { createSession } from '@/services/roleplay/sessions';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Check, Star } from 'lucide-react';

// Helper to wait for simulated client to be linked
async function waitForSimulatedClient(sessionId: string, maxAttempts = 5): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await supabase
      .from('roleplay_sessions')
      .select('*, simulated_clients(*)')
      .eq('id', sessionId)
      .single();
    
    if (data?.simulated_clients) {
      return data;
    }
    
    // Wait 500ms before retrying
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  throw new Error('Timeout waiting for simulated client');
}

export default function NewRoleplay() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedICP, setSelectedICP] = useState<string | null>(null);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);

  const { data: seller, isLoading: loadingSeller } = useQuery({
    queryKey: ['current-seller'],
    queryFn: getCurrentSeller
  });

  const { data: icps, isLoading: loadingICPs } = useQuery({
    queryKey: ['icps', seller?.organization_id],
    queryFn: listICPs,
    enabled: !!seller?.organization_id
  });

  const { data: archetypes, isLoading: loadingArchetypes } = useQuery({
    queryKey: ['archetypes', seller?.organization_id],
    queryFn: listArchetypes,
    enabled: !!seller?.organization_id
  });

  const { data: rubrics } = useQuery({
    queryKey: ['rubrics', seller?.organization_id],
    queryFn: listRubrics,
    enabled: !!seller?.organization_id
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!seller || !selectedICP || !selectedArchetype) {
        throw new Error('Missing required data');
      }

      const defaultRubric = rubrics?.[0];
      if (!defaultRubric) {
        throw new Error('No evaluation rubric found');
      }

      // Get full ICP and Archetype data
      const icp = icps?.find(i => i.id === selectedICP);
      const archetype = archetypes?.find(a => a.id === selectedArchetype);

      console.log('[NewRoleplay] Starting session creation...');

      // Generate simulated client
      const { data: clientData, error: clientError } = await supabase.functions.invoke(
        'ai-generate-client',
        {
          body: {
            icpId: selectedICP,
            archetypeId: selectedArchetype,
            organizationId: seller.organization_id,
            icpData: icp,
            archetypeData: archetype
          }
        }
      );

      if (clientError) throw clientError;

      console.log('[NewRoleplay] Client generated:', clientData?.client?.fake_name);

      // Insert simulated client
      const { data: simulatedClient, error: insertClientError } = await supabase
        .from('simulated_clients')
        .insert({
          organization_id: seller.organization_id,
          icp_id: selectedICP,
          archetype_id: selectedArchetype,
          fake_name: clientData.client.fake_name,
          fake_company: clientData.client.fake_company,
          fake_cnpj: clientData.client.fake_cnpj,
          fake_role: clientData.client.fake_role,
          tone_style: clientData.client.tone_style,
          decision_role: clientData.client.decision_role,
          objection_pattern: clientData.client.objection_pattern
        })
        .select()
        .single();

      if (insertClientError) throw insertClientError;

      console.log('[NewRoleplay] Simulated client inserted:', simulatedClient.id);

      // Create session
      const session = await createSession({
        sellerId: seller.id,
        icpId: selectedICP,
        archetypeId: selectedArchetype,
        rubricId: defaultRubric.id,
        organizationId: seller.organization_id
      });

      console.log('[NewRoleplay] Session created:', session.id);

      // Link simulated client to session
      const { error: linkError } = await supabase
        .from('roleplay_sessions')
        .update({ simulated_client_id: simulatedClient.id })
        .eq('id', session.id);

      if (linkError) {
        console.error('[NewRoleplay] Error linking client:', linkError);
        throw linkError;
      }

      console.log('[NewRoleplay] Client linked to session');

      // CRITICAL: Wait for the link to propagate and verify
      const sessionWithClient = await waitForSimulatedClient(session.id);
      console.log('[NewRoleplay] Session verified with client:', !!sessionWithClient.simulated_clients);

      // Generate initial AI message INSIDE the mutation to guarantee it completes
      console.log('[NewRoleplay] Generating initial AI message...');
      
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-simulate-client', {
        body: {
          sessionId: session.id,
          sellerMessage: '__INIT__',
          conversationHistory: [],
          simulatedClient: sessionWithClient.simulated_clients,
          icpData: icp,
          archetypeData: archetype,
          exchangeCount: 0,
          generateGreeting: true
        }
      });

      if (aiError) {
        console.error('[NewRoleplay] AI greeting error:', aiError);
        throw new Error('Falha ao gerar mensagem inicial do cliente');
      }

      if (!aiResponse?.response) {
        console.error('[NewRoleplay] Empty AI response');
        throw new Error('Resposta vazia da IA');
      }

      // Insert the initial message
      const { error: msgError } = await supabase.from('roleplay_messages').insert({
        id: crypto.randomUUID(),
        session_id: session.id,
        sender: 'ai_client',
        content: aiResponse.response,
        timestamp: new Date().toISOString()
      });

      if (msgError) {
        console.error('[NewRoleplay] Error inserting initial message:', msgError);
        throw new Error('Falha ao salvar mensagem inicial');
      }

      console.log('[NewRoleplay] Initial message created successfully');

      // Return session ID only after everything is ready
      return session.id;
    },
    onSuccess: async (sessionId) => {
      // CRÍTICO: Verificar auth antes de navegar
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      if (!authSession) {
        console.error('[NewRoleplay] No auth session before navigation');
        toast({
          title: 'Sessão expirada',
          description: 'Faça login novamente para continuar.',
          variant: 'destructive'
        });
        navigate('/login');
        return;
      }

      // Refresh token if expiring soon
      const expiresAt = authSession.expires_at ? authSession.expires_at * 1000 : 0;
      if (expiresAt - Date.now() < 5 * 60 * 1000) {
        console.log('[NewRoleplay] Token expiring soon, refreshing before navigation...');
        await supabase.auth.refreshSession();
      }

      toast({
        title: 'Cliente gerado!',
        description: 'Sua simulação está pronta. Boa sorte!',
      });
      
      // Small delay to ensure DB propagation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      navigate(`/app/roleplay/chat/${sessionId}`);
    },
    onError: (error) => {
      console.error('[NewRoleplay] Mutation error:', error);
      toast({
        title: 'Erro ao criar sessão',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    }
  });

  const selectedICPData = icps?.find(i => i.id === selectedICP);
  const selectedArchetypeData = archetypes?.find(a => a.id === selectedArchetype);

  if (loadingSeller || loadingICPs || loadingArchetypes) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground">Novo Treino</h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                Configure sua simulação de vendas com IA
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/app/roleplay')}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="flex gap-2 justify-center">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 w-12 rounded-full transition-colors ${
                  s <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Step 1: Select ICP */}
          {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Selecione o Perfil de Cliente (ICP)</h2>
              <p className="text-muted-foreground">
                Escolha o tipo de cliente que deseja simular
              </p>
            </div>

            <div className="grid gap-4">
              {icps?.map((icp) => (
                <Card
                  key={icp.id}
                  className={`p-6 cursor-pointer transition-all hover:shadow-lg ${
                    selectedICP === icp.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedICP(icp.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{icp.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {icp.segment} • {icp.company_size}
                      </p>
                    </div>
                    {selectedICP === icp.id && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Dores principais:</span>
                      <ul className="list-disc list-inside text-muted-foreground ml-2">
                        {(icp.pain_points as string[] || []).slice(0, 3).map((pain, i) => (
                          <li key={i}>{pain}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!selectedICP}
              onClick={() => setStep(2)}
            >
              Continuar
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
            </div>
          )}

          {/* Step 2: Select Archetype */}
          {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Selecione o Tipo de Cliente</h2>
              <p className="text-muted-foreground">
                Escolha a personalidade e nível de dificuldade
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {archetypes?.map((archetype) => (
                <Card
                  key={archetype.id}
                  className={`p-6 cursor-pointer transition-all hover:shadow-lg ${
                    selectedArchetype === archetype.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedArchetype(archetype.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{archetype.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {archetype.type} • {archetype.level}
                      </p>
                    </div>
                    {selectedArchetype === archetype.id && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Tom:</span>
                      <span className="text-muted-foreground capitalize">{archetype.tone_style}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Papel:</span>
                      <span className="text-muted-foreground">{archetype.decision_role}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium mr-2">Dificuldade:</span>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${
                            i < (archetype.complexity_score || 3)
                              ? 'fill-warning text-warning'
                              : 'text-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <div>
                      <span className="font-medium">Mín. trocas:</span>
                      <span className="text-muted-foreground ml-2">
                        {archetype.min_message_exchanges}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button
                className="flex-1"
                size="lg"
                disabled={!selectedArchetype}
                onClick={() => setStep(3)}
              >
                Continuar
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Confirmar e Iniciar</h2>
              <p className="text-muted-foreground">
                Revise as configurações do seu treino
              </p>
            </div>

            <Card className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold mb-2">ICP Selecionado</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="font-medium">{selectedICPData?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedICPData?.segment} • {selectedICPData?.company_size}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Arquétipo Selecionado</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="font-medium">{selectedArchetypeData?.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {selectedArchetypeData?.tone_style} • {selectedArchetypeData?.decision_role}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${
                          i < (selectedArchetypeData?.complexity_score || 3)
                            ? 'fill-warning text-warning'
                            : 'text-muted'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold">Regras do Treino</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>✓ Mínimo de {selectedArchetypeData?.min_message_exchanges || 50} trocas de mensagens</li>
                  <li>✓ Nota de corte: {rubrics?.[0]?.passing_score || 8.0}/10 para aprovação</li>
                  <li>✓ Janela de treino: 09:00 - 09:30 BRT</li>
                  <li>✓ Cliente será gerado automaticamente pela IA</li>
                </ul>
              </div>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(2)}
                disabled={createMutation.isPending}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button
                className="flex-1"
                size="lg"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
              {createMutation.isPending ? (
                  <>
                    <div className="h-4 w-4 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Gerando cliente...
                  </>
                ) : (
                  'Gerar Cliente e Iniciar'
                )}
              </Button>
            </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
