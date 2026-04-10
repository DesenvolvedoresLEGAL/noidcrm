
-- Insert 8 workflow rules for VENDAS pipeline (activity_completed → move stage + create activities)
-- Pipeline VENDAS: 59a4780d-0b92-4a48-be49-ee490be93dbf
-- Organization: d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d

INSERT INTO workflow_rules (organization_id, name, trigger_type, trigger_config, actions, is_active)
VALUES
-- Rule 1: Proposta na Mesa → FUP-1
('d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d',
 'VENDAS: Avançar + Orquestrar - Proposta na Mesa → FUP-1',
 'activity_completed',
 '{"pipeline_id":"59a4780d-0b92-4a48-be49-ee490be93dbf","stage_id":"29ac03c4-e7b1-42eb-9e50-22701e3839d2"}'::jsonb,
 '[{"type":"move_stage","config":{"target_pipeline_id":"59a4780d-0b92-4a48-be49-ee490be93dbf","target_stage_id":"6bd429b6-b1bb-4a25-8a3f-c15f76c2f40a"}},{"type":"create_activity","config":{"activity_type":"follow_up","title":"WhatsApp - 1ª tentativa de negociação","days_offset":0}},{"type":"create_activity","config":{"activity_type":"email","title":"Email - reforço negociação FUP-1","days_offset":1}},{"type":"create_activity","config":{"activity_type":"call","title":"Ligar - follow-up negociação FUP-1","days_offset":1}}]'::jsonb,
 true),

-- Rule 2: FUP-1 → FUP-2
('d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d',
 'VENDAS: Avançar + Orquestrar - FUP-1 → FUP-2',
 'activity_completed',
 '{"pipeline_id":"59a4780d-0b92-4a48-be49-ee490be93dbf","stage_id":"6bd429b6-b1bb-4a25-8a3f-c15f76c2f40a"}'::jsonb,
 '[{"type":"move_stage","config":{"target_pipeline_id":"59a4780d-0b92-4a48-be49-ee490be93dbf","target_stage_id":"cb5a151b-7c50-4fdc-8a07-49aea98b1e5e"}},{"type":"create_activity","config":{"activity_type":"follow_up","title":"WhatsApp - 2ª tentativa de negociação","days_offset":0}},{"type":"create_activity","config":{"activity_type":"email","title":"Email - reforço negociação FUP-2","days_offset":1}},{"type":"create_activity","config":{"activity_type":"call","title":"Ligar - follow-up negociação FUP-2","days_offset":1}}]'::jsonb,
 true),

-- Rule 3: FUP-2 → FUP-3
('d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d',
 'VENDAS: Avançar + Orquestrar - FUP-2 → FUP-3',
 'activity_completed',
 '{"pipeline_id":"59a4780d-0b92-4a48-be49-ee490be93dbf","stage_id":"cb5a151b-7c50-4fdc-8a07-49aea98b1e5e"}'::jsonb,
 '[{"type":"move_stage","config":{"target_pipeline_id":"59a4780d-0b92-4a48-be49-ee490be93dbf","target_stage_id":"7ae71536-e0bb-49a3-a0a8-f62cffbce61e"}},{"type":"create_activity","config":{"activity_type":"follow_up","title":"WhatsApp - 3ª tentativa de negociação","days_offset":0}},{"type":"create_activity","config":{"activity_type":"email","title":"Email - reforço negociação FUP-3","days_offset":1}},{"type":"create_activity","config":{"activity_type":"call","title":"Ligar - follow-up negociação FUP-3","days_offset":1}}]'::jsonb,
 true),

-- Rule 4: FUP-3 → FUP-4
('d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d',
 'VENDAS: Avançar + Orquestrar - FUP-3 → FUP-4',
 'activity_completed',
 '{"pipeline_id":"59a4780d-0b92-4a48-be49-ee490be93dbf","stage_id":"7ae71536-e0bb-49a3-a0a8-f62cffbce61e"}'::jsonb,
 '[{"type":"move_stage","config":{"target_pipeline_id":"59a4780d-0b92-4a48-be49-ee490be93dbf","target_stage_id":"5baf2f3a-e916-41f4-991b-5308a8d2e2d3"}},{"type":"create_activity","config":{"activity_type":"follow_up","title":"WhatsApp - 4ª tentativa de negociação","days_offset":0}},{"type":"create_activity","config":{"activity_type":"email","title":"Email - reforço negociação FUP-4","days_offset":1}},{"type":"create_activity","config":{"activity_type":"call","title":"Ligar - follow-up negociação FUP-4","days_offset":1}}]'::jsonb,
 true),

-- Rule 5: FUP-4 → FUP-5
('d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d',
 'VENDAS: Avançar + Orquestrar - FUP-4 → FUP-5',
 'activity_completed',
 '{"pipeline_id":"59a4780d-0b92-4a48-be49-ee490be93dbf","stage_id":"5baf2f3a-e916-41f4-991b-5308a8d2e2d3"}'::jsonb,
 '[{"type":"move_stage","config":{"target_pipeline_id":"59a4780d-0b92-4a48-be49-ee490be93dbf","target_stage_id":"1f21821d-06fc-4535-b3d7-eefa9c3d4c15"}},{"type":"create_activity","config":{"activity_type":"follow_up","title":"WhatsApp - 5ª tentativa de negociação","days_offset":0}},{"type":"create_activity","config":{"activity_type":"email","title":"Email - reforço negociação FUP-5","days_offset":1}},{"type":"create_activity","config":{"activity_type":"call","title":"Ligar - follow-up negociação FUP-5","days_offset":1}}]'::jsonb,
 true),

-- Rule 6: FUP-5 → FUP-6
('d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d',
 'VENDAS: Avançar + Orquestrar - FUP-5 → FUP-6',
 'activity_completed',
 '{"pipeline_id":"59a4780d-0b92-4a48-be49-ee490be93dbf","stage_id":"1f21821d-06fc-4535-b3d7-eefa9c3d4c15"}'::jsonb,
 '[{"type":"move_stage","config":{"target_pipeline_id":"59a4780d-0b92-4a48-be49-ee490be93dbf","target_stage_id":"29a73410-a8a7-4bbe-8574-4a0eed6d9f47"}},{"type":"create_activity","config":{"activity_type":"follow_up","title":"WhatsApp - 6ª tentativa de negociação","days_offset":0}},{"type":"create_activity","config":{"activity_type":"email","title":"Email - reforço negociação FUP-6","days_offset":1}},{"type":"create_activity","config":{"activity_type":"call","title":"Ligar - follow-up negociação FUP-6","days_offset":1}}]'::jsonb,
 true),

-- Rule 7: FUP-6 → FUP-7
('d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d',
 'VENDAS: Avançar + Orquestrar - FUP-6 → FUP-7',
 'activity_completed',
 '{"pipeline_id":"59a4780d-0b92-4a48-be49-ee490be93dbf","stage_id":"29a73410-a8a7-4bbe-8574-4a0eed6d9f47"}'::jsonb,
 '[{"type":"move_stage","config":{"target_pipeline_id":"59a4780d-0b92-4a48-be49-ee490be93dbf","target_stage_id":"c107ec6e-0b4e-418c-a9fb-6a1cb000d59c"}},{"type":"create_activity","config":{"activity_type":"follow_up","title":"WhatsApp - 7ª tentativa de negociação","days_offset":0}},{"type":"create_activity","config":{"activity_type":"email","title":"Email - reforço negociação FUP-7","days_offset":1}},{"type":"create_activity","config":{"activity_type":"call","title":"Ligar - follow-up negociação FUP-7","days_offset":1}}]'::jsonb,
 true),

-- Rule 8: FUP-7 → Pré-Aprovação
('d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d',
 'VENDAS: Avançar + Orquestrar - FUP-7 → Pré-Aprovação',
 'activity_completed',
 '{"pipeline_id":"59a4780d-0b92-4a48-be49-ee490be93dbf","stage_id":"c107ec6e-0b4e-418c-a9fb-6a1cb000d59c"}'::jsonb,
 '[{"type":"move_stage","config":{"target_pipeline_id":"59a4780d-0b92-4a48-be49-ee490be93dbf","target_stage_id":"fee549f1-41b7-49f2-abb2-a5a1dc1e9a14"}},{"type":"create_activity","config":{"activity_type":"follow_up","title":"WhatsApp - confirmação pré-aprovação","days_offset":0}},{"type":"create_activity","config":{"activity_type":"email","title":"Email - documentação pré-aprovação","days_offset":1}},{"type":"create_activity","config":{"activity_type":"call","title":"Ligar - validar pré-aprovação","days_offset":1}}]'::jsonb,
 true);
