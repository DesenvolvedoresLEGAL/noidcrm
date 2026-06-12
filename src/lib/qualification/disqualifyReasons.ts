export type DisqualifyReasonSlug =
  | 'sem_evento'
  | 'sem_data'
  | 'sem_local'
  | 'sem_escopo_minimo'
  | 'sem_conexoes'
  | 'sem_finalidade'
  | 'sem_urgencia'
  | 'sem_decisor'
  | 'sem_proximo_passo'
  | 'cliente_pesquisando'
  | 'pedido_generico_preco'
  | 'baixa_maturidade'
  | 'nao_respondeu'
  | 'nao_visualizou_proposta'
  | 'nao_precisa_solucao'
  | 'fora_icp'
  | 'concorrente_escolhido'
  | 'preco_inviavel'
  | 'outro';

export interface DisqualifyReasonOption {
  slug: DisqualifyReasonSlug;
  label: string;
}

export const DISQUALIFY_REASONS: DisqualifyReasonOption[] = [
  { slug: 'sem_evento', label: 'Sem evento definido' },
  { slug: 'sem_data', label: 'Sem data do evento' },
  { slug: 'sem_local', label: 'Sem local definido' },
  { slug: 'sem_escopo_minimo', label: 'Sem escopo mínimo' },
  { slug: 'sem_conexoes', label: 'Sem quantidade de conexões' },
  { slug: 'sem_finalidade', label: 'Sem finalidade clara de uso' },
  { slug: 'sem_urgencia', label: 'Sem urgência real' },
  { slug: 'sem_decisor', label: 'Sem decisor ou influência' },
  { slug: 'sem_proximo_passo', label: 'Sem próximo passo' },
  { slug: 'cliente_pesquisando', label: 'Cliente apenas pesquisando' },
  { slug: 'pedido_generico_preco', label: 'Pedido genérico de preço' },
  { slug: 'baixa_maturidade', label: 'Baixa maturidade' },
  { slug: 'nao_respondeu', label: 'Não respondeu após contato' },
  { slug: 'nao_visualizou_proposta', label: 'Não visualizou proposta' },
  { slug: 'nao_precisa_solucao', label: 'Não precisa mais da solução' },
  { slug: 'fora_icp', label: 'Fora do ICP' },
  { slug: 'concorrente_escolhido', label: 'Concorrente escolhido' },
  { slug: 'preco_inviavel', label: 'Preço inviável' },
  { slug: 'outro', label: 'Outro' },
];

export const DISQUALIFY_REASON_LABEL: Record<DisqualifyReasonSlug, string> =
  DISQUALIFY_REASONS.reduce((acc, opt) => {
    acc[opt.slug] = opt.label;
    return acc;
  }, {} as Record<DisqualifyReasonSlug, string>);
