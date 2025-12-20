import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: 'Como recuperar minha senha?',
    answer: 'Acesse a tela de login e clique em "Esqueci minha senha". Você receberá um email com instruções para redefinir sua senha. Caso não receba o email, verifique sua pasta de spam.',
  },
  {
    question: 'Como exportar relatórios para Excel?',
    answer: 'Na página de Relatórios, selecione o relatório desejado e clique no botão "Exportar" no canto superior direito. Você pode escolher entre os formatos Excel (.xlsx), CSV ou PDF.',
  },
  {
    question: 'Como adicionar novos usuários à minha organização?',
    answer: 'Acesse Configurações > Usuários e clique em "Convidar usuário". Preencha o email do novo usuário e selecione o perfil de acesso desejado. O convidado receberá um email para criar sua conta.',
  },
  {
    question: 'O que significam os status das oportunidades?',
    answer: 'Cada etapa do pipeline representa uma fase da negociação. Os status padrão incluem: Prospecção, Qualificação, Proposta, Negociação e Fechamento. Você pode personalizar as etapas em Configurações > Pipelines.',
  },
  {
    question: 'Como funciona o Scoring de leads?',
    answer: 'O Scoring utiliza inteligência artificial para analisar o perfil e comportamento dos leads, atribuindo uma pontuação de 0 a 100. Quanto maior a pontuação, maior a probabilidade de conversão. Você pode ver os fatores que influenciam o score no detalhe de cada lead.',
  },
];

interface SupportFAQProps {
  showViewAll?: boolean;
}

export function SupportFAQ({ showViewAll = true }: SupportFAQProps) {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HelpCircle className="h-5 w-5 text-primary" />
          FAQ Rápido
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {faqs.map((faq, index) => (
          <div key={index} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleFAQ(index)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <span className="font-medium text-foreground">{faq.question}</span>
              <motion.div
                animate={{ rotate: openIndex === index ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </button>
            <AnimatePresence>
              {openIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="px-4 pb-4 text-sm text-muted-foreground">
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {showViewAll && (
          <Button
            variant="ghost"
            className="w-full mt-2"
            onClick={() => navigate('/app/docs')}
          >
            Ver todos os artigos
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
