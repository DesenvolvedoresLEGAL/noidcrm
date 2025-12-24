import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
export interface VibeNarrative {
  id: string;
  organization_id: string;
  vibe_state: string;
  title: string;
  narrative_template: string;
  key_messages: string[] | null;
  proof_points: string[] | null;
  objection_handlers: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

// Narrativas padrão por vibe_state
export const DEFAULT_NARRATIVES: Omit<VibeNarrative, 'id' | 'organization_id' | 'created_at' | 'updated_at'>[] = [
  {
    vibe_state: 'curioso',
    title: 'Visão e Possibilidades',
    narrative_template: 'O lead está curioso e aberto a explorar. Foque em pintar uma visão inspiradora do futuro que sua solução pode criar. Use linguagem que desperte a imaginação e mostre o potencial de transformação.',
    key_messages: [
      'Imagine se você pudesse...',
      'Outras empresas como a sua já estão alcançando...',
      'O que seria possível se você não tivesse mais essa limitação?'
    ],
    proof_points: [
      'Cases de transformação inspiradores',
      'Dados de mercado sobre tendências',
      'Visão de futuro do setor'
    ],
    objection_handlers: {
      'não tenho tempo': 'Entendo a correria. Justamente por isso, vou te mostrar como outras empresas economizam tempo com nossa solução.',
      'não é prioridade agora': 'Faz sentido. Quando você imagina o momento ideal para resolver isso, o que precisa acontecer antes?'
    }
  },
  {
    vibe_state: 'exploratorio',
    title: 'Descoberta e Perguntas',
    narrative_template: 'O lead está em modo de descoberta, fazendo perguntas e buscando entender. Seja um guia paciente, faça perguntas abertas e ajude-o a articular suas próprias necessidades.',
    key_messages: [
      'Me conta mais sobre como vocês fazem hoje...',
      'O que você considera mais importante resolver primeiro?',
      'Como seria o cenário ideal para você?'
    ],
    proof_points: [
      'Demonstrações interativas',
      'Comparativos de funcionalidades',
      'Depoimentos de clientes similares'
    ],
    objection_handlers: {
      'preciso pesquisar mais': 'Claro! Que informações seriam mais úteis para sua pesquisa? Posso preparar algo específico.',
      'tenho outras opções': 'Ótimo que você está avaliando bem. O que você considera os critérios mais importantes na sua decisão?'
    }
  },
  {
    vibe_state: 'cetico',
    title: 'Provas e Cases',
    narrative_template: 'O lead precisa de evidências concretas. Abandone o discurso de vendas e traga dados, números, cases e provas tangíveis. Seja objetivo e mostre resultados reais.',
    key_messages: [
      'Os números mostram que...',
      'A empresa X, do mesmo segmento que vocês, conseguiu...',
      'Posso compartilhar o estudo de caso completo?'
    ],
    proof_points: [
      'Métricas de ROI de clientes',
      'Cases documentados com números',
      'Depoimentos em vídeo',
      'Garantias e SLAs'
    ],
    objection_handlers: {
      'já tentei algo parecido': 'Entendo a frustração. O que aconteceu nessa experiência? Nosso diferencial é justamente...',
      'não acredito que funciona': 'Ceticismo é saudável. Posso conectar você com um cliente nosso para ouvir diretamente a experiência deles?'
    }
  },
  {
    vibe_state: 'comparativo',
    title: 'Diferenciação e Risco',
    narrative_template: 'O lead está comparando opções. Não ataque concorrentes, mas evidencie claramente seus diferenciais e os riscos de uma escolha inadequada.',
    key_messages: [
      'O que nos diferencia é...',
      'Um ponto importante a considerar na sua decisão é...',
      'Clientes que vieram de outras soluções relatam que...'
    ],
    proof_points: [
      'Comparativos objetivos',
      'Histórias de migração bem-sucedida',
      'Diferenciais exclusivos',
      'Custos ocultos de alternativas'
    ],
    objection_handlers: {
      'o concorrente é mais barato': 'Entendo a preocupação com investimento. Quando você olha o custo total incluindo X, Y, Z, nossa proposta oferece...',
      'o outro tem mais recursos': 'Verdade que eles têm recursos diferentes. A questão é: quais recursos realmente impactam seu resultado?'
    }
  },
  {
    vibe_state: 'em_decisao',
    title: 'Urgência e Benefícios de Agir',
    narrative_template: 'O lead está próximo da decisão. Crie senso de urgência genuíno e reforce os benefícios de agir agora versus continuar esperando.',
    key_messages: [
      'Se começarmos agora, você já terá resultados em...',
      'Cada mês de espera significa...',
      'Vamos garantir as condições especiais antes que...'
    ],
    proof_points: [
      'Cálculo de custo de inação',
      'Timeline de implementação',
      'Garantias e suporte',
      'Condições especiais com prazo'
    ],
    objection_handlers: {
      'preciso pensar mais': 'Entendo. Qual ponto específico você gostaria de ter mais clareza antes de decidir?',
      'vou consultar meu sócio': 'Perfeito. Posso preparar um resumo executivo para facilitar a conversa? Ou seria melhor uma reunião rápida com os dois?'
    }
  },
  {
    vibe_state: 'travado',
    title: 'Empatia e Remoção de Barreiras',
    narrative_template: 'O lead está travado por algum motivo. Demonstre empatia genuína, identifique a barreira real e ajude a removê-la sem pressão.',
    key_messages: [
      'Percebo que algo está te deixando hesitante...',
      'Sem compromisso: o que precisaria mudar para isso fazer sentido?',
      'Como posso ajudar a tornar isso mais fácil?'
    ],
    proof_points: [
      'Opções de pagamento flexíveis',
      'Implementação gradual',
      'Período de teste',
      'Garantia de satisfação'
    ],
    objection_handlers: {
      'não é o momento': 'Entendo perfeitamente. O que precisa acontecer para ser o momento certo?',
      'é muito complexo': 'Você tem razão de se preocupar com isso. Deixa eu te mostrar como simplificamos a adoção...'
    }
  },
  {
    vibe_state: 'quente_silencioso',
    title: 'Nudge Sutil',
    narrative_template: 'O lead demonstrou interesse mas ficou silencioso. Use toques leves e criativos para reengajar sem parecer desesperado.',
    key_messages: [
      'Vi um case novo que lembrei de você...',
      'Surgiu uma novidade que pode ser interessante...',
      'Estava revisando nossa conversa e pensei em...'
    ],
    proof_points: [
      'Conteúdo de valor genuíno',
      'Notícias relevantes do setor',
      'Novos recursos ou updates',
      'Cases recentes similares'
    ],
    objection_handlers: {
      'silêncio': 'Sem resposta? Tudo bem. Vou enviar algo de valor sem pedir nada em troca.',
      'muita coisa acontecendo': 'Imagino a correria. Fico por aqui quando fizer sentido retomar.'
    }
  },
  {
    vibe_state: 'pronto_inseguro',
    title: 'Segurança e Processo',
    narrative_template: 'O lead quer comprar mas está inseguro. Transmita segurança mostrando o processo, os bastidores e o que acontece após a compra.',
    key_messages: [
      'Vou te mostrar exatamente como funciona após você dizer sim...',
      'Sua pessoa de contato será...',
      'Nos primeiros 30 dias, vamos...'
    ],
    proof_points: [
      'Detalhes do onboarding',
      'Apresentar equipe de suporte',
      'Timeline pós-venda clara',
      'Depoimentos sobre o processo de implementação'
    ],
    objection_handlers: {
      'e se não funcionar': 'Entendo a preocupação. Temos garantia de X dias. E mais: vou acompanhar pessoalmente seu início.',
      'medo de mudar': 'Mudança dá frio na barriga mesmo. Por isso fazemos uma transição gradual com suporte dedicado.'
    }
  }
];

export function useVibeNarratives(vibeState?: string) {
  const { profile } = useCurrentUser();
  const queryClient = useQueryClient();

  const { data: narratives, isLoading } = useQuery({
    queryKey: ['vibe-narratives', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('vibe_narratives')
        .select('*')
        .eq('organization_id', profile.organization_id);

      if (error) throw error;
      return data as VibeNarrative[];
    },
    enabled: !!profile?.organization_id
  });

  const initializeDefaultNarratives = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error('No organization');

      const narrativesToInsert = DEFAULT_NARRATIVES.map(n => ({
        ...n,
        organization_id: profile.organization_id
      }));

      const { error } = await supabase
        .from('vibe_narratives')
        .upsert(narrativesToInsert, { 
          onConflict: 'organization_id,vibe_state',
          ignoreDuplicates: true 
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vibe-narratives'] });
    }
  });

  // Retorna a narrativa para o vibe_state específico ou fallback para default
  const getNarrativeForState = (state: string): VibeNarrative | Omit<VibeNarrative, 'id' | 'organization_id' | 'created_at' | 'updated_at'> | null => {
    // Primeiro procura nas narrativas da organização
    const orgNarrative = narratives?.find(n => n.vibe_state === state);
    if (orgNarrative) return orgNarrative;

    // Fallback para narrativa padrão
    return DEFAULT_NARRATIVES.find(n => n.vibe_state === state) || null;
  };

  const currentNarrative = vibeState ? getNarrativeForState(vibeState) : null;

  return {
    narratives,
    currentNarrative,
    isLoading,
    initializeDefaultNarratives,
    getNarrativeForState
  };
}
