INSERT INTO public.release_notes (version, title, description, release_date, is_major, changes)
VALUES (
  '1.32.0',
  'Tabela Dinâmica Transparente & Propostas mais Claras',
  'Eliminamos qualquer ruído entre o valor exibido e o valor vigente da tabela dinâmica em propostas, com matemática explícita no link público e PDF, alertas de divergência com sincronização em 1 clique, gatilhos de urgência baseados na próxima vigência, e correções importantes na visão da oportunidade.',
  CURRENT_DATE,
  true,
  '[
    {"type":"feature","description":"Link público e PDF agora exibem o detalhamento completo da tabela dinâmica: Subtotal dos Itens, Ajuste por antecedência (+X%) e Total Vigente Hoje, eliminando dúvidas do cliente."},
    {"type":"feature","description":"Micro-texto de urgência no link público e PDF: \"Condição vigente até DD/MM. A partir de DD/MM, novo valor: R$ X.\" para incentivar decisão antes da próxima faixa."},
    {"type":"feature","description":"Novo alerta de divergência no editor e na tela de Pagamento quando o valor exibido difere do vigente da tabela dinâmica, com botão \"Recalcular e sincronizar agora\"."},
    {"type":"feature","description":"Helper unificado getDynamicPricingBreakdown garante que header, condições de pagamento, link público e PDF sempre mostrem o mesmo valor vigente."},
    {"type":"fix","description":"Card da Proposta na aba da Oportunidade agora reflete o valor vigente real da tabela dinâmica (antes mostrava o subtotal avulso desatualizado)."},
    {"type":"fix","description":"Card da Proposta agora mostra a data de Validade configurada da proposta em vez do vencimento da primeira parcela."},
    {"type":"fix","description":"Resumo do Investimento no PDF e no link público recalibrado para acomodar a linha de ajuste sem cortar conteúdo."},
    {"type":"improvement","description":"Bloco \"Dados do Deal > Valores\" agora exibe \"Valor Total\" no lugar de \"Valor Avulso\", mais alinhado à realidade do funil de vendas."},
    {"type":"improvement","description":"Atualização de propostas abertas em massa para template EVENTO com tabela dinâmica ativa via orquestração financeira centralizada."},
    {"type":"improvement","description":"Invalidações de cache reforçadas: ao recalcular a tabela dinâmica, todas as views (editor, pagamento, link público, PDF, kanban da oportunidade) refletem o valor novo instantaneamente."}
  ]'::jsonb
);