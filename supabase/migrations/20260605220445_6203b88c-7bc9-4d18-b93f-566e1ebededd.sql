UPDATE public.release_notes
SET
  title = 'Release semanal NOID CRM, v1.35.0',
  description = 'Evolução semanal do NOID CRM: avanços em inteligência de perdas, dashboards executivos, controles de qualidade e segurança. Revise antes de publicar.',
  changes = '[
    {"type":"feature","description":"Nova visão de Perdas por Etapa no CRM ajuda a identificar onde as oportunidades estão sendo perdidas no pipeline."},
    {"type":"feature","description":"Card de Release Notes Automático no Admin Command Center mostra última execução, próximo agendamento e rascunhos pendentes."},
    {"type":"feature","description":"Tabela dinâmica agora atualiza dados automaticamente, sem precisar recarregar a página."},
    {"type":"feature","description":"Quantidades passam a ser exibidas com a unidade de medida (ex: 5 kg) em telas e relatórios."},
    {"type":"improvement","description":"CRM Trust Score unificado: uma única métrica consistente em todas as áreas da plataforma."},
    {"type":"improvement","description":"Sincronização de divergências comerciais agora é automática, reduzindo trabalho manual da operação."},
    {"type":"improvement","description":"Rotinas de processamento mais rápidas, melhorando o tempo de resposta em telas pesadas."},
    {"type":"improvement","description":"Coleta de release notes agora lê commits reais do GitHub, gerando rascunhos com a evolução real da semana."},
    {"type":"security","description":"Acesso público a propostas e formulários foi reforçado: validação adicional de credenciais e remoção de controles de acesso público amplos."},
    {"type":"fix","description":"Corrigida atribuição da etapa de origem em oportunidades perdidas — agora reflete a última etapa real antes da perda."},
    {"type":"fix","description":"Alertas falsos no Forecast deixaram de aparecer indevidamente."},
    {"type":"fix","description":"Datas de vencimento na tela de ajuda voltaram a aparecer corretamente."}
  ]'::jsonb,
  source_summary = COALESCE(source_summary, '{}'::jsonb) || '{"editorial_notes":["manual_rewrite_v1.35.0_WL_QUALITY"]}'::jsonb
WHERE id = 'd122c2db-41f3-4e84-8640-191c7025087e' AND status = 'draft';