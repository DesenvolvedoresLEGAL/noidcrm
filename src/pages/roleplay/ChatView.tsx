import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getSession, getSessionMessages, sendMessage, endSession } from '@/services/roleplay/sessions';
import { ChatBubble } from '@/components/roleplay/ChatBubble';
import { Timer } from '@/components/roleplay/Timer';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Send, Phone, User, Building, Briefcase } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: ['roleplay-session', sessionId],
    queryFn: () => getSession(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 5000 // Refresh every 5s to get updated exchange count
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ['roleplay-messages', sessionId],
    queryFn: () => getSessionMessages(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 2000 // Refresh messages frequently
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!session) throw new Error('No session');

      try {
        // Get authentication token
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        
        if (!accessToken) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }

        // Send seller message
        await sendMessage({
          sessionId: sessionId!,
          sender: 'seller',
          content
        });

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
            exchangeCount: (session.exchanges_count || 0) + 1
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
      
      console.log('Encerrando sessão:', sessionId);
      // End session
      await endSession(sessionId!);
      console.log('Sessão encerrada, iniciando avaliação');

      // Get all messages for evaluation
      const allMessages = await getSessionMessages(sessionId!);

      // Evaluate session
      const { data: evaluation, error: evalError } = await supabase.functions.invoke(
        'ai-evaluate-session',
        {
          body: {
            sessionId: sessionId!,
            rubricId: session?.rubric_id,
            messages: allMessages.map(m => ({
              sender: m.sender,
              text: m.content
            }))
          }
        }
      );

      if (evalError) throw evalError;

      // Generate insights
      await supabase.functions.invoke('ai-generate-insights', {
        body: {
          sessionId: sessionId!,
          sellerId: session?.seller_id,
          scoresJson: evaluation.evaluation,
          messages: allMessages,
          organizationId: session?.organization_id
        }
      });

      // Recommend videos
      await supabase.functions.invoke('ai-recommend-videos', {
        body: {
          sessionId: sessionId!,
          sellerId: session?.seller_id,
          scoresJson: evaluation.evaluation
        }
      });

      return sessionId;
    },
    onSuccess: (sessionId) => {
      toast({
        title: 'Treino encerrado',
        description: 'Sua sessão foi finalizada e avaliada com sucesso'
      });
      navigate(`/app/roleplay/summary/${sessionId}`);
    },
    onError: (error) => {
      setIsEvaluating(false);
      toast({
        title: 'Erro ao avaliar sessão',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    }
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
        <div className="flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p>Sessão não encontrada</p>
          <Button onClick={() => navigate('/app/roleplay')} className="mt-4">
            Voltar
          </Button>
        </div>
      </Layout>
    );
  }

  const client = session.simulated_clients;

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex flex-col max-w-5xl mx-auto">
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

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Progresso: {session.exchanges_count || 0}/{MIN_MESSAGES_TO_END} mensagens
              </span>
              <span className={`font-medium ${canEnd ? 'text-success' : 'text-muted-foreground'}`}>
                {canEnd ? '✓ Pode encerrar' : 'Continue conversando'}
              </span>
            </div>
            <Progress value={progressPct} className="h-2" />
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
            {messages?.map((msg) => (
              <ChatBubble
                key={msg.id}
                sender={msg.sender as 'seller' | 'ai_client'}
                content={msg.content}
                timestamp={msg.timestamp}
                clientName={client?.fake_name}
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
        <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Encerrar Sessão de Treino?</AlertDialogTitle>
              <AlertDialogDescription>
                {isEvaluating ? (
                  <div className="flex items-center gap-3 py-4">
                    <LoadingSpinner />
                    <span>Avaliando sua performance com IA...</span>
                  </div>
                ) : (
                  <>
                    Sua sessão será avaliada automaticamente pela IA.
                    Você receberá uma nota detalhada e recomendações de vídeos.
                    <br /><br />
                    <strong>Total de trocas: {session.exchanges_count || 0}</strong>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {!isEvaluating && (
              <AlertDialogFooter>
                <AlertDialogCancel>Continuar Treinando</AlertDialogCancel>
                <AlertDialogAction onClick={() => endMutation.mutate()}>
                  Encerrar e Avaliar
                </AlertDialogAction>
              </AlertDialogFooter>
            )}
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}