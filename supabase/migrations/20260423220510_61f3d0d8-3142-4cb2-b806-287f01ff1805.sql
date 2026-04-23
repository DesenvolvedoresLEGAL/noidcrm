-- Criar o release note v1.31.0 com JSON escapado corretamente
INSERT INTO release_notes (version, title, description, release_date, is_major, changes)
VALUES (
  '1.31.0',
  'Sincronização em Tempo Real & Correções Críticas',
  'Release focado em correções de sincronização de dados, eliminação de notificações fantasmas de propostas vencidas, e melhorias na experiência do pipeline com atualizações em tempo real.',
  '2026-04-23',
  true,
  jsonb_build_array(
    jsonb_build_object('type', 'fix', 'description', 'Correção definitiva de notificações de propostas vencidas aparecendo para deals já ganhos ou perdidos - implementação de proteção de status terminal'),
    jsonb_build_object('type', 'fix', 'description', 'Correção de sincronização de engajamento de e-mails (aberturas e respostas) no CRM - thread correlation aprimorado'),
    jsonb_build_object('type', 'fix', 'description', 'Correção de cache do pipeline: cards de oportunidades excluídas ou movidas de etapa agora desaparecem imediatamente sem necessidade de hard refresh'),
    jsonb_build_object('type', 'fix', 'description', 'Correção de status downgrade em propostas - impedir que propostas aceitas/rejeitadas voltem para status sent'),
    jsonb_build_object('type', 'feature', 'description', 'Sistema de background Gmail thread lookup para correlação automática de threads após envio SMTP'),
    jsonb_build_object('type', 'feature', 'description', 'Auto-sincronização de respostas de e-mail ao abrir aba de e-mails da oportunidade'),
    jsonb_build_object('type', 'improvement', 'description', 'RefetchType all implementado em todas as invalidações de cache para forçar atualização mesmo de queries inativas'),
    jsonb_build_object('type', 'improvement', 'description', 'Navegação do OpportunityDetail aguarda invalidação de cache antes de retornar ao pipeline'),
    jsonb_build_object('type', 'improvement', 'description', 'Realtime subscriptions para oportunidades aplicam refetchType all em mudanças detectadas'),
    jsonb_build_object('type', 'improvement', 'description', 'Delayed invalidation passes (1.5s e 4s) após conclusão de atividades para capturar mudanças de workflow'),
    jsonb_build_object('type', 'security', 'description', 'Edge function check-proposal-expiration endurecida para excluir propostas com accepted_at ou declined_at preenchidos'),
    jsonb_build_object('type', 'security', 'description', 'Cleanup de 371 notificações zombie vinculadas a deals em status terminal'),
    jsonb_build_object('type', 'security', 'description', 'Normalização de status de propostas no banco de dados para consistência com timestamps')
  )
);