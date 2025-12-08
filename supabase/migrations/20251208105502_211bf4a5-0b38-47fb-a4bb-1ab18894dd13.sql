-- Insert v1.27.0 release note with dashboard features
INSERT INTO release_notes (
  version, 
  title, 
  description, 
  release_date, 
  is_major, 
  changes
) VALUES (
  '1.27.0',
  'Dashboards Inteligentes por Perfil',
  'Sistema de dashboards personalizados para cada tipo de usuário com design premium e animações sofisticadas.',
  '2025-12-08',
  true,
  '[
    {"type": "feature", "description": "Dashboard Rep (Vendedor) com KPIs pessoais, atividades pendentes e leads quentes"},
    {"type": "feature", "description": "Dashboard Manager com ranking do time, heatmap de atividades e coaching AI"},
    {"type": "feature", "description": "Dashboard Admin com saúde da base, automações e governança de dados"},
    {"type": "feature", "description": "Dashboard Owner (CEO Cockpit) com MRR/ARR, forecast AI e insights estratégicos"},
    {"type": "improvement", "description": "Design premium com glassmorphism, animações framer-motion e micro-interações"},
    {"type": "improvement", "description": "KPI Cards redesenhados com gradientes, glow effects e sparklines"},
    {"type": "improvement", "description": "Headers dinâmicos com saudação personalizada e ícones por perfil"},
    {"type": "improvement", "description": "Sistema de grid responsivo otimizado para mobile, tablet e desktop"}
  ]'::jsonb
);