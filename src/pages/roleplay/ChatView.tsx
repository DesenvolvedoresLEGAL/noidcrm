import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getSession, getSessionMessages, sendMessage, endSession } from '@/services/roleplay/sessions';
import { saveSessionProgress, clearSessionProgress } from '@/services/roleplay/sessionRecovery';
import { ChatBubble } from '@/components/roleplay/ChatBubble';
import { Timer } from '@/components/roleplay/Timer';
import { EvaluationLoadingOverlay } from '@/components/roleplay/EvaluationLoadingOverlay';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useRoleplaySession } from '@/hooks/useRoleplaySession';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Send, Phone, User, Building, Briefcase, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ChatView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationStep, setEvaluationStep] = useState(0);
  const [checkpoints, setCheckpoints] = useState<string[]>([]);
  const [tokenWarning, setTokenWarning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { startSession, endSession: endRoleplaySession } = useRoleplaySession();
  const { profile } = useUserProfile();

  // Register this session as active to prevent silent logout
  useEffect(() => {
    if (sessionId) {
      startSession(sessionId);
      console.log('[ChatView] Session registered as active:', sessionId);
    }
    return () => {
      endRoleplaySession();
      console.log('[ChatView] Session unregistered');
    };
  }, [sessionId, startSession, endRoleplaySession]);

  // Proactive token refresh to prevent mid-session expiration
  const ensureValidToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        console.warn('[ChatView] No session found');
        setTokenWarning(true);
        return null;
      }
      
      // Check if token expires within 5 minutes
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const fiveMinutes = 5 * 60 * 1000;
      const now = Date.now();
      
      if (expiresAt - now < fiveMinutes) {
        console.log('[ChatView] Token expiring soon, refreshing...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          console.error('[ChatView] Token refresh failed:', refreshError);
          setTokenWarning(true);
          toast({
            title: 'Sessão expirando',
            description: 'Sua sessão está expirando. Salve seu progresso.',
            variant: 'destructive'
          });
          return null;
        }
        
        console.log('[ChatView] Token refreshed successfully');
        setTokenWarning(false);
        return refreshData.session.access_token;
      }
      
      setTokenWarning(false);
      return session.access_token;
    } catch (err) {
      console.error('[ChatView] Error checking token:', err);
      setTokenWarning(true);
      return null;
    }
  }, [toast]);

  const { data: session, isLoading: loadingSession, error: sessionError } = useQuery({
    queryKey: ['roleplay-session', sessionId],
    queryFn: async () => {
      console.log('[ChatView] Fetching session:', sessionId);
      const result = await getSession(sessionId!);
      console.log('[ChatView] Session result:', { 
        hasResult: !!result,
        hasClient: !!result?.simulated_clients,
        exchangeCount: result?.exchanges_count 
      });
      return result;
    },
    enabled: !!sessionId,
    // Polling reduzido (15s); mensagens são invalidadas via mutation success
    refetchInterval: 15000,
    retry: 3,
    retryDelay: 1000
  });

  // Auto-rescue: if session already finished, redirect straight to summary
  useEffect(() => {
    if (session && (session as any).finished_at && !isEvaluating) {
      console.log('[ChatView] Session already finished, redirecting to summary');
      endRoleplaySession();
      navigate(`/app/roleplay/summary/${sessionId}`, { replace: true });
    }
  }, [session, isEvaluating, sessionId, navigate, endRoleplaySession]);
  const messageRetryCountRef = useRef(0);
  const MAX_MESSAGE_RETRIES = 5;

  const { data: messages, refetch: refetchMessages, isLoading: loadingMessages, error: messagesError } = useQuery({
    queryKey: ['roleplay-messages', sessionId],
    queryFn: async () => {
      // CRÍTICO: Verificar auth antes de buscar mensagens
      const { data: { session: authSession } } = await supabase.auth.getSession();
      
      if (!authSession) {
        console.error('[ChatView] No auth session when fetching messages');
        throw new Error('AUTH_REQUIRED');
      }
      
      console.log('[ChatView] Auth OK, fetching messages. Attempt:', messageRetryCountRef.current + 1);
      const result = await getSessionMessages(sessionId!);
      
      // Se retornou vazio mas temos sessão válida, pode ser timing issue
      if (result.length === 0 && messageRetryCountRef.current < MAX_MESSAGE_RETRIES) {
        messageRetryCountRef.current++;
        console.log('[ChatView] Empty messages, will retry. Count:', messageRetryCountRef.current);
      } else if (result.length > 0) {
        messageRetryCountRef.current = 0; // Reset on success
      }
      
      return result;
    },
    enabled: !!sessionId,
    // Fase 1A: 5s → 10s (mensagens são invalidadas pela mutation de envio).
    refetchInterval: 10000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000)
  });

  // State for generating initial message fallback
  const [isGeneratingInitial, setIsGeneratingInitial] = useState(false);
  const fallbackAttemptRef = useRef(0);
  const MAX_FALLBACK_ATTEMPTS = 3;

  // Fallback: Generate initial message if none exists (with retry)
  useEffect(() => {
    const generateInitialMessage = async () => {
      // Condições para NÃO executar
      if (!session || !session.simulated_clients) return;
      if (loadingMessages) return;
      if (messages && messages.length > 0) return;
      if (isGeneratingInitial) return;
      if (fallbackAttemptRef.current >= MAX_FALLBACK_ATTEMPTS) return;

      // Aguardar um pouco antes de tentar (pode ser timing issue)
      const delay = fallbackAttemptRef.current * 1500; // 0ms, 1500ms, 3000ms
      if (delay > 0) {
        console.log(`[ChatView] Waiting ${delay}ms before fallback attempt ${fallbackAttemptRef.current + 1}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Re-check após delay
      if (messages && messages.length > 0) return;

      fallbackAttemptRef.current++;
      setIsGeneratingInitial(true);
      console.log(`[ChatView] Fallback attempt ${fallbackAttemptRef.current}/${MAX_FALLBACK_ATTEMPTS}`);

      try {
        // Verificar auth antes de chamar edge function
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (!authSession) {
          console.error('[ChatView] No auth for fallback generation');
          toast({
            title: 'Sessão expirada',
            description: 'Faça login novamente para continuar.',
            variant: 'destructive'
          });
          navigate('/login');
          return;
        }

        const { data: aiResponse, error: aiError } = await supabase.functions.invoke('ai-simulate-client', {
          body: {
            sessionId,
            sellerMessage: '__INIT__',
            conversationHistory: [],
            simulatedClient: session.simulated_clients,
            icpData: session.icp_profiles,
            archetypeData: session.client_archetypes,
            exchangeCount: 0,
            generateGreeting: true
          }
        });

        if (aiError) {
          console.error('[ChatView] Fallback AI error:', aiError);
          if (fallbackAttemptRef.current >= MAX_FALLBACK_ATTEMPTS) {
            toast({
              title: 'Erro ao iniciar conversa',
              description: 'Não foi possível gerar a mensagem inicial. Tente atualizar a página.',
              variant: 'destructive'
            });
          }
          return;
        }

        if (aiResponse?.response) {
          const { error: insertError } = await supabase.from('roleplay_messages').insert({
            id: crypto.randomUUID(),
            session_id: sessionId,
            sender: 'ai_client',
            content: aiResponse.response,
            timestamp: new Date().toISOString()
          });
          
          if (insertError) {
            console.error('[ChatView] Failed to insert fallback message:', insertError);
          } else {
            console.log('[ChatView] Fallback message created successfully');
            fallbackAttemptRef.current = MAX_FALLBACK_ATTEMPTS; // Stop retrying
            refetchMessages();
          }
        }
      } catch (err) {
        console.error('[ChatView] Fallback generation error:', err);
      } finally {
        setIsGeneratingInitial(false);
      }
    };

    generateInitialMessage();
  }, [session, messages, loadingMessages, sessionId, isGeneratingInitial, refetchMessages, toast, navigate]);

  // Calculate checkpoints based on conversation analysis
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const newCheckpoints: string[] = [];
    const sellerMessages = messages.filter(m => m.sender === 'seller');
    const clientMessages = messages.filter(m => m.sender === 'ai_client');

    // Checkpoint 1: Discovery (vendedor fez perguntas relevantes)
    const hasQuestions = sellerMessages.some(m => m.content.includes('?'));
    if (hasQuestions && sellerMessages.length >= 3) {
      newCheckpoints.push('discovery');
    }

    // Checkpoint 2: Pain Identified (cliente mencionou problemas)
    const painKeywords = ['problema', 'dificuldade', 'desafio', 'preciso', 'necessito'];
    const hasPainMention = clientMessages.some(m => 
      painKeywords.some(k => m.content.toLowerCase().includes(k))
    );
    if (hasPainMention) {
      newCheckpoints.push('pain_identified');
    }

    // Checkpoint 3: Objection Answered (cliente reconheceu argumentos)
    const validationKeywords = ['faz sentido', 'entendi', 'ok', 'certo', 'interessante'];
    const hasValidation = clientMessages.some(m => 
      validationKeywords.some(k => m.content.toLowerCase().includes(k))
    );
    if (hasValidation && sellerMessages.length >= 5) {
      newCheckpoints.push('objection_answered');
    }

    // Checkpoint 4: Opening for Closing (cliente sinalizou interesse em próximos passos)
    const closingKeywords = ['agendar', 'próximo', 'reunião', 'proposta', 'começar', 'avançar'];
    const hasClosingSignal = clientMessages.some(m => 
      closingKeywords.some(k => m.content.toLowerCase().includes(k))
    );
    if (hasClosingSignal) {
      newCheckpoints.push('opening_for_closing');
    }

    setCheckpoints(newCheckpoints);
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!session) throw new Error('No session');

      try {
        // Proactive token validation and refresh
        const accessToken = await ensureValidToken();
        
        if (!accessToken) {
          throw new Error('Sessão expirada. Salve seu progresso e faça login novamente.');
        }

        // Send seller message
        await sendMessage({
          sessionId: sessionId!,
          sender: 'seller',
          content
        });

        // Save progress locally
        saveSessionProgress(sessionId!, (session.exchanges_count || 0) + 1);

        setIsTyping(true);

        // Get conversation history for AI
        const history = await getSessionMessages(sessionId!);

        console.log('[ChatView] Preparing AI call:', {
          sessionId,
          hasToken: !!accessToken,
          messageLength: content.length,
          historyLength: history.length,
          hasClient: !!session.simulated_clients,
          hasICP: !!session.icp_profiles,
          exchangeCount: (session.exchanges_count || 0) + 1
        });

        // Call AI to generate client response
        const { data, error } = await supabase.functions.invoke('ai-simulate-client', {
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          body: {
            sessionId: sessionId!,
            sellerMessage: content,
            conversationHistory: history.map(m => ({
              sender: m.sender,
              text: m.content
            })),
            simulatedClient: session.simulated_clients,
            icpData: session.icp_profiles,
            archetypeData: session.client_archetypes,
            exchangeCount: (session.exchanges_count || 0) + 1,
            objectionsResolved: (session as any).objections_resolved || []
          }
        });
        
        console.log('[ChatView] AI call response:', { hasData: !!data, hasError: !!error });

        if (error) {
          console.error('[ChatView] Edge function error:', {
            error,
            message: error.message,
            context: (error as any)?.context,
            status: (error as any)?.context?.response?.status
          });
          
          // Extract status code and detailed error message
          const status = (error as any)?.context?.response?.status;
          const detail = (error as any)?.context?.error || (error as any)?.context?.message;
          
          let errorMessage: string;
          
          if (status === 402) {
            errorMessage = 'Créditos de IA esgotados. Adicione créditos em Configurações → Uso.';
          } else if (status === 429) {
            errorMessage = 'Muitas solicitações. Tente novamente em instantes.';
          } else if (status === 401) {
            errorMessage = 'Sessão expirada. Faça login novamente.';
          } else if (status === 400) {
            errorMessage = `Erro de validação: ${detail || 'Dados inválidos'}`;
          } else {
            errorMessage = detail || error.message || 'Erro interno na IA. Tente novamente.';
          }
          
          console.error('[ChatView] Throwing error:', errorMessage);
          throw new Error(errorMessage);
        }

        if (!data || !data.response) {
          console.error('Invalid response from edge function:', data);
          throw new Error('Resposta inválida da IA');
        }

        console.log('AI response received, length:', data.response.length);

        // Send AI response
        await sendMessage({
          sessionId: sessionId!,
          sender: 'ai_client',
          content: data.response
        });

        setIsTyping(false);
      } catch (err) {
        setIsTyping(false);
        throw err;
      }
    },
    onSuccess: () => {
      refetchMessages();
      setInput('');
    },
    onError: (error) => {
      toast({
        title: 'Erro ao enviar mensagem',
        description: error instanceof Error ? error.message : 'Erro desconhecido ao processar resposta',
        variant: 'destructive'
      });
    }
  });

  const endMutation = useMutation({
    mutationFn: async () => {
      setIsEvaluating(true);
      setEvaluationStep(1);

      console.log('[ChatView] Finalizing session via orchestrator:', sessionId);

      // Single orchestrator call: marks finished_at + runs evaluate (blocking)
      // and queues videos/insights/gamification/missions in background.
      setEvaluationStep(2);
      const { data, error } = await supabase.functions.invoke('finalize-roleplay-session', {
        body: { sessionId: sessionId! },
      });

      if (error) {
        console.error('[ChatView] finalize-roleplay-session error:', error);
        // Even on error, the function marks finished_at first — so we still navigate.
        // Throw so onError shows toast, but onSettled-style navigation is handled below.
        throw error;
      }

      setEvaluationStep(5);
      console.log('[ChatView] Finalize complete:', data);

      return { sessionId: sessionId!, evaluationStatus: data?.evaluationStatus };
    },
    onSuccess: (result) => {
      clearSessionProgress(result.sessionId);
      endRoleplaySession();

      toast({
        title: 'Treino encerrado',
        description: result.evaluationStatus === 'complete'
          ? 'Sessão finalizada e avaliada com sucesso.'
          : 'Sessão finalizada. Avaliação em processamento — você pode acompanhar no resumo.',
      });
      navigate(`/app/roleplay/summary/${result.sessionId}`);
    },
    onError: (error) => {
      // Session was likely marked finished_at by the orchestrator before failing.
      // Send the user to the summary anyway so they don't get stuck.
      console.error('[ChatView] endMutation error, navigating to summary anyway:', error);
      clearSessionProgress(sessionId!);
      endRoleplaySession();
      toast({
        title: 'Sessão encerrada com aviso',
        description: 'A avaliação pode ainda estar processando. Confira no resumo em instantes.',
        variant: 'default',
      });
      navigate(`/app/roleplay/summary/${sessionId}`);
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending) return;
    sendMutation.mutate(input);
  };

  const handleTimeExpire = () => {
    if (!showEndDialog && !isEvaluating) {
      toast({
        title: 'Tempo esgotado',
        description: 'A sessão atingiu 30 minutos e será encerrada automaticamente',
        variant: 'default'
      });
      // Auto-end after 2 seconds to give user time to see the toast
      setTimeout(() => {
        endMutation.mutate();
      }, 2000);
    }
  };

  // Always allow ending after 15 messages minimum
  const MIN_MESSAGES_TO_END = 15;
  const canEnd = (session?.exchanges_count || 0) >= MIN_MESSAGES_TO_END;
  const progressPct = Math.min(100, ((session?.exchanges_count || 0) / MIN_MESSAGES_TO_END) * 100);

  if (loadingSession) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <LoadingSpinner />
          <p className="text-muted-foreground">Carregando sessão de treino...</p>
        </div>
      </Layout>
    );
  }

  if (sessionError) {
    console.error('[ChatView] Session error:', sessionError);
    return (
      <Layout>
        <div className="text-center py-12 space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">Erro ao carregar sessão</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Não foi possível carregar a sessão de treino. 
            Verifique sua conexão e tente novamente.
          </p>
          <p className="text-sm text-destructive">
            {sessionError instanceof Error ? sessionError.message : 'Erro desconhecido'}
          </p>
          <Button onClick={() => navigate('/app/roleplay')} className="mt-4">
            Voltar para Roleplay
          </Button>
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="text-center py-12 space-y-4">
          <AlertTriangle className="h-12 w-12 text-warning mx-auto" />
          <h2 className="text-xl font-semibold">Sessão não encontrada</h2>
          <p className="text-muted-foreground">
            Esta sessão pode ter expirado ou você não tem acesso a ela.
          </p>
          <Button onClick={() => navigate('/app/roleplay')} className="mt-4">
            Voltar para Roleplay
          </Button>
        </div>
      </Layout>
    );
  }

  if (!session.simulated_clients) {
    return (
      <Layout>
        <div className="text-center py-12 space-y-4">
          <LoadingSpinner />
          <h2 className="text-xl font-semibold">Preparando cliente simulado...</h2>
          <p className="text-muted-foreground">
            Aguarde enquanto geramos o cliente para sua simulação.
          </p>
        </div>
      </Layout>
    );
  }

  const client = session.simulated_clients;

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex flex-col max-w-5xl mx-auto">
        {/* Token Warning Banner */}
        {tokenWarning && (
          <Card className="p-3 mb-2 bg-destructive/10 border-destructive/30">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>Sua sessão está expirando. Conclua o treino para não perder seu progresso.</span>
            </div>
          </Card>
        )}
        
        {/* Header */}
        <Card className="p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary rounded-full">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">{client?.fake_name}</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Briefcase className="h-3 w-3" />
                  {client?.fake_role}
                  <span className="text-muted">•</span>
                  <Building className="h-3 w-3" />
                  {client?.fake_company}
                </p>
              </div>
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowEndDialog(true)}
              disabled={!canEnd || endMutation.isPending}
            >
              <Phone className="h-4 w-4 mr-2" />
              Encerrar
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Progresso: {session.exchanges_count || 0}/{MIN_MESSAGES_TO_END} mensagens
              </span>
              <span className={`font-medium ${canEnd ? 'text-success' : 'text-muted-foreground'}`}>
                {canEnd ? '✓ Pode encerrar' : 'Continue conversando'}
              </span>
            </div>
            <Progress value={progressPct} className="h-2" />
            
            {/* Checkpoints Indicators */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Checkpoints:</span>
              <div className={`px-2 py-1 rounded-md text-xs font-medium ${
                checkpoints.includes('discovery') 
                  ? 'bg-success/20 text-success' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {checkpoints.includes('discovery') ? '✓' : '○'} Descoberta
              </div>
              <div className={`px-2 py-1 rounded-md text-xs font-medium ${
                checkpoints.includes('pain_identified') 
                  ? 'bg-success/20 text-success' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {checkpoints.includes('pain_identified') ? '✓' : '○'} Dor Identificada
              </div>
              <div className={`px-2 py-1 rounded-md text-xs font-medium ${
                checkpoints.includes('objection_answered') 
                  ? 'bg-success/20 text-success' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {checkpoints.includes('objection_answered') ? '✓' : '○'} Objeção Respondida
              </div>
              <div className={`px-2 py-1 rounded-md text-xs font-medium ${
                checkpoints.includes('opening_for_closing') 
                  ? 'bg-success/20 text-success' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {checkpoints.includes('opening_for_closing') ? '✓' : '○'} Abertura p/ Fechamento
              </div>
            </div>
          </div>

          <Timer
            startTime={new Date(session.started_at)}
            durationMinutes={30}
            onExpire={handleTimeExpire}
          />
        </Card>

        {/* Messages Area */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Loading or generating initial message */}
            {(loadingMessages || isGeneratingInitial) && (!messages || messages.length === 0) && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <LoadingSpinner />
                <p className="text-muted-foreground text-sm">
                  {isGeneratingInitial ? 'Gerando mensagem inicial...' : 'Carregando conversa...'}
                </p>
              </div>
            )}

            {messages?.map((msg) => (
              <ChatBubble
                key={msg.id}
                sender={msg.sender as 'seller' | 'ai_client'}
                content={msg.content}
                timestamp={msg.timestamp}
                clientName={client?.fake_name}
                userAvatarUrl={profile?.avatar_url}
                userName={profile?.full_name}
              />
            ))}
            
            {isTyping && (
              <div className="flex gap-3">
                <div className="h-8 w-8 shrink-0 bg-secondary rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium">C</span>
                </div>
                <div className="bg-muted px-4 py-2.5 rounded-2xl rounded-tl-sm">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Digite sua mensagem..."
                className="min-h-[60px] resize-none"
                disabled={sendMutation.isPending}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || sendMutation.isPending}
                size="lg"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Pressione Enter para enviar, Shift+Enter para quebrar linha
            </p>
          </div>
        </Card>

        {/* End Session Dialog */}
        <AlertDialog open={showEndDialog} onOpenChange={isEvaluating ? undefined : setShowEndDialog}>
          <AlertDialogContent className={isEvaluating ? "sm:max-w-md p-0 overflow-hidden" : ""}>
            {isEvaluating ? (
              <EvaluationLoadingOverlay 
                currentStep={evaluationStep} 
                isVisible={true}
                onSkip={() => {
                  endRoleplaySession();
                  navigate(`/app/roleplay/summary/${sessionId}`);
                }}
              />
            ) : (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Encerrar Sessão de Treino?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sua sessão será avaliada automaticamente pela IA.
                    Você receberá uma nota detalhada e recomendações de vídeos.
                    <br /><br />
                    <strong>Total de trocas: {session.exchanges_count || 0}</strong>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Continuar Treinando</AlertDialogCancel>
                  <AlertDialogAction onClick={() => endMutation.mutate()}>
                    Encerrar e Avaliar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            )}
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}