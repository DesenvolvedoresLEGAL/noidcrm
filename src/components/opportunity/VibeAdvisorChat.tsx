import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Brain,
  Send,
  Sparkles,
  Lightbulb,
  AlertTriangle,
  Target,
  Heart,
  Zap,
  MessageCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface VibeAdvisorChatProps {
  opportunityId: string;
  opportunityTitle?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  { icon: Target, text: 'Como devo abordar agora?', color: 'text-blue-500' },
  { icon: AlertTriangle, text: 'Qual risco emocional existe?', color: 'text-orange-500' },
  { icon: Heart, text: 'Devo provocar ou acolher?', color: 'text-pink-500' },
  { icon: Zap, text: 'Está pronto para fechar?', color: 'text-yellow-500' },
];

export function VibeAdvisorChat({ opportunityId, opportunityTitle }: VibeAdvisorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-vibe-advisor', {
        body: {
          opportunityId,
          question,
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
        },
      });

      if (error) throw error;

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setContext(data.context);
    } catch (err) {
      console.error('Erro ao consultar advisor:', err);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Desculpe, não consegui processar sua pergunta. Tente novamente em instantes.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader className="pb-3 border-b shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            Conselheiro de Vibe
          </CardTitle>
          {context && (
            <div className="flex gap-1">
              {context.vibeState && (
                <Badge variant="outline" className="text-[10px]">
                  {context.vibeState}
                </Badge>
              )}
              {context.temperature && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[10px]",
                    context.temperature === 'burning' && "bg-red-100 text-red-700",
                    context.temperature === 'hot' && "bg-orange-100 text-orange-700",
                    context.temperature === 'warm' && "bg-yellow-100 text-yellow-700",
                    context.temperature === 'cold' && "bg-blue-100 text-blue-700",
                  )}
                >
                  {context.temperature}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-6">
                <Sparkles className="h-10 w-10 mx-auto text-primary/50 mb-3" />
                <p className="text-sm text-muted-foreground mb-1">
                  Sou seu conselheiro de Vibe Selling
                </p>
                <p className="text-xs text-muted-foreground">
                  Pergunte sobre timing, tom, riscos ou estratégia para este lead
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground px-1">
                  Perguntas rápidas:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_QUESTIONS.map((q, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="justify-start text-xs h-auto py-2 px-3"
                      onClick={() => sendMessage(q.text)}
                      disabled={isLoading}
                    >
                      <q.icon className={cn("h-3 w-3 mr-2 shrink-0", q.color)} />
                      <span className="truncate">{q.text}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2",
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1 mb-1">
                        <Lightbulb className="h-3 w-3 text-primary" />
                        <span className="text-[10px] font-medium text-primary">Conselheiro</span>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2 max-w-[85%]">
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse flex gap-1">
                        <div className="h-2 w-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="h-2 w-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="h-2 w-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-muted-foreground">Analisando contexto...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-3 border-t shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre este lead..."
              disabled={isLoading}
              className="text-sm"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
