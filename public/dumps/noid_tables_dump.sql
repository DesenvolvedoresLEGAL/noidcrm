-- =====================================================
-- NOID REVENUE OS - FULL DATABASE DUMP
-- Generated: 2026-01-07
-- Tables: profiles, organization_members, teams, team_members, products
-- =====================================================

-- Disable foreign key checks for import
SET session_replication_role = 'replica';

-- =====================================================
-- TABLE: profiles
-- =====================================================
DELETE FROM profiles WHERE id IN (
  'b44757d8-50df-41d6-a2dd-be631aeff0c8',
  '0a7e7b2e-f81a-4246-b4a3-9f19ff52f564',
  '9259900b-8ac0-4da3-a4ad-636db21a4f38',
  '5b67b15f-48b6-41d2-a55e-dc1a441f10bb',
  '9a82a532-bdbd-495a-bba3-44467e1d4f26',
  '15473880-f990-44c8-94a0-167e20c01f9a',
  '04ca4218-bed7-4489-9a7f-17bea6f95465',
  'e104c6c9-7c26-483c-82a6-6605c2546b92',
  '1ee78920-1025-41cd-93b8-d2d55649be1a',
  '6cee2151-7650-43f9-a0f7-773103deb770'
);

INSERT INTO profiles (id, user_id, full_name, avatar_url, created_at, updated_at, organization_id, monthly_goal, last_login_at, email, phone, birth_date, cpf, default_pipeline_id) VALUES
('b44757d8-50df-41d6-a2dd-be631aeff0c8', '2008ce75-4dfd-4bab-acbb-a117a0fee958', 'Diego Ramos', NULL, '2025-12-26 17:04:16.217836+00', '2025-12-26 17:04:16.217836+00', '1b02e04f-9dde-48ff-abe9-392cbe981a2e', 0.00, '2025-12-27 23:47:56.310941+00', NULL, NULL, NULL, NULL, NULL),
('0a7e7b2e-f81a-4246-b4a3-9f19ff52f564', '91055957-8270-45aa-a452-2045daa893ee', 'Jessica Machado', 'https://urihdqturaebhiefwjnw.supabase.co/storage/v1/object/public/avatars/avatars/91055957-8270-45aa-a452-2045daa893ee-1765200552061.jpeg', '2025-11-09 00:56:02.118992+00', '2025-11-09 00:56:02.118992+00', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 60000.00, '2026-01-05 20:31:37.675464+00', 'jessica@operadora.legal', '', NULL, '', '59a4780d-0b92-4a48-be49-ee490be93dbf'),
('9259900b-8ac0-4da3-a4ad-636db21a4f38', '8de12473-4b1c-472f-84ad-b841ec9e033b', 'Luciano Yves de Oliveira', NULL, '2025-12-11 11:59:01.026677+00', '2025-12-11 11:59:01.026677+00', '8c58f8e4-be79-46c5-9d1f-bff53851627b', 0.00, '2025-12-11 11:59:01.1126+00', NULL, NULL, NULL, NULL, NULL),
('5b67b15f-48b6-41d2-a55e-dc1a441f10bb', 'deb0b602-a5c8-4dcc-a814-225d6aa04227', 'Leonardo Honório', 'https://urihdqturaebhiefwjnw.supabase.co/storage/v1/object/public/avatars/avatars/deb0b602-a5c8-4dcc-a814-225d6aa04227-1764962950734.jpeg', '2025-11-09 00:56:02.118992+00', '2025-11-09 00:56:02.118992+00', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 0.00, '2026-01-07 15:29:09.029237+00', 'leonardo@operadora.legal', '', NULL, '', '59a4780d-0b92-4a48-be49-ee490be93dbf'),
('9a82a532-bdbd-495a-bba3-44467e1d4f26', '0a33e0ba-ee0b-49c3-8ddf-898487c38ec5', 'João Parolini', NULL, '2025-12-17 13:12:36.894743+00', '2025-12-17 13:12:36.894743+00', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 0.00, '2026-01-07 16:16:35.593035+00', 'joao@operadora.legal', '', NULL, '', '97a78715-c2e5-426c-b248-979b7718af03'),
('15473880-f990-44c8-94a0-167e20c01f9a', '3d3b4cd3-2b23-447b-8ab9-b037e9fb7f38', 'Victor Mazuchi', NULL, '2025-12-12 16:28:22.275087+00', '2025-12-12 16:28:22.275087+00', 'a8ccf8c7-dbea-41b1-adc2-0285999d1a33', 0.00, '2025-12-12 16:28:22.358718+00', NULL, NULL, NULL, NULL, NULL),
('04ca4218-bed7-4489-9a7f-17bea6f95465', '287d4a52-b182-4d7d-9429-bb0b1f8f9b61', 'Jaqueline', 'https://urihdqturaebhiefwjnw.supabase.co/storage/v1/object/public/avatars/avatars/287d4a52-b182-4d7d-9429-bb0b1f8f9b61-1764963206527.jpg', '2025-11-09 00:56:02.118992+00', '2025-11-09 00:56:02.118992+00', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 0.00, '2026-01-07 17:45:05.528564+00', 'jaqueline@operadora.legal', '', NULL, '', '59a4780d-0b92-4a48-be49-ee490be93dbf'),
('e104c6c9-7c26-483c-82a6-6605c2546b92', 'e104c6c9-7c26-483c-82a6-6605c2546b92', 'Bruno', '', '2025-12-15 13:21:44.560696+00', '2025-12-15 13:21:44.560696+00', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 0.00, '2026-01-07 17:59:01.763479+00', 'bruno@operadora.legal', '', NULL, '', '97a78715-c2e5-426c-b248-979b7718af03'),
('1ee78920-1025-41cd-93b8-d2d55649be1a', '1e837442-e0bf-4df5-8cf0-3750de4fecdc', 'Robério Santos', 'https://urihdqturaebhiefwjnw.supabase.co/storage/v1/object/public/avatars/avatars/1e837442-e0bf-4df5-8cf0-3750de4fecdc-1764853961607.jpg', '2025-11-09 00:56:02.118992+00', '2025-11-09 00:56:02.118992+00', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 300000.00, '2026-01-07 18:14:39.412713+00', 'roberio@operadora.legal', '', NULL, '', '59a4780d-0b92-4a48-be49-ee490be93dbf'),
('6cee2151-7650-43f9-a0f7-773103deb770', '14f79e75-d044-4742-ac08-cab713b497ec', 'Glaucia Sarti', 'https://urihdqturaebhiefwjnw.supabase.co/storage/v1/object/public/avatars/avatars/14f79e75-d044-4742-ac08-cab713b497ec-1765814957263.jpeg', '2025-12-09 19:04:17.294803+00', '2025-12-09 19:04:17.294803+00', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 0.00, '2026-01-05 15:40:13.375083+00', 'glaucia@operadora.legal', '', NULL, '', '97a78715-c2e5-426c-b248-979b7718af03');

-- =====================================================
-- TABLE: organization_members
-- =====================================================
INSERT INTO organization_members (id, organization_id, user_id, role, org_role, status, invited_at, invited_by, joined_at, created_at, permission_set_id) VALUES
('ee4b1453-b14a-4304-8b1a-f1817eddf11b', '8c58f8e4-be79-46c5-9d1f-bff53851627b', '8de12473-4b1c-472f-84ad-b841ec9e033b', 'owner', 'owner', 'active', NULL, NULL, '2025-12-11 12:00:31.395+00', '2025-12-11 12:00:31.481983+00', NULL),
('3063da82-bb0f-4266-a655-24954f90b8a0', 'a8ccf8c7-dbea-41b1-adc2-0285999d1a33', '3d3b4cd3-2b23-447b-8ab9-b037e9fb7f38', 'owner', 'owner', 'active', NULL, NULL, '2025-12-12 16:28:50.886+00', '2025-12-12 16:28:50.967117+00', NULL),
('4bb37f8c-0539-4da0-813e-115a6dce3413', '35567a2f-d268-46a3-9361-bb44da669f3e', 'b27234c2-cc29-4df6-85cb-73af95adb9c4', 'owner', 'owner', 'active', NULL, NULL, '2025-12-12 19:35:03.502+00', '2025-12-12 19:35:03.66341+00', NULL),
('3c8f99b2-56c3-486d-a247-8828b10d4174', '774d7d78-8257-4891-aac7-718039b80049', '6d3df423-f210-4857-82d5-b068abdce96d', 'owner', 'owner', 'active', NULL, NULL, '2025-12-13 00:09:31.233779+00', '2025-12-13 00:09:31.233779+00', NULL),
('be6180de-a9c3-48ac-ab00-26b0059b41fc', '774d7d78-8257-4891-aac7-718039b80049', '5971212a-4959-4dc8-81e6-e8d4928912b9', 'owner', 'owner', 'active', NULL, NULL, '2025-12-17 14:19:20.86647+00', '2025-12-17 14:19:20.86647+00', NULL),
('fcac6a5e-3825-4b47-ac90-04090ddc8f06', '774d7d78-8257-4891-aac7-718039b80049', '2f105444-3183-4574-8958-6e0b082c19a1', 'owner', 'finance', 'active', NULL, NULL, '2025-12-15 18:19:37.227+00', '2025-12-15 18:19:36.689907+00', NULL),
('3d7af0e4-7529-4cda-9ae6-a8c6d6bf1cd8', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '03998534-ef85-47cb-9713-b5d5fb2cf71d', 'member', 'admin', 'active', NULL, NULL, '2025-12-23 13:31:43.17+00', '2025-12-23 13:31:43.252482+00', NULL),
('f6b7c6b0-cb39-427e-a75f-669655c39463', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '0a33e0ba-ee0b-49c3-8ddf-898487c38ec5', 'member', 'operations', 'active', NULL, NULL, '2025-12-17 13:12:37.393+00', '2025-12-17 13:12:37.482866+00', NULL),
('a2bd3245-63ee-489b-b9b4-0c71e8682f93', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'e104c6c9-7c26-483c-82a6-6605c2546b92', 'member', 'operations', 'active', NULL, NULL, '2025-12-15 13:15:52.203+00', '2025-12-15 13:15:52.288374+00', NULL),
('d6e07c5d-b09d-4c7d-8169-2f584563ea85', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '14f79e75-d044-4742-ac08-cab713b497ec', 'member', 'finance', 'active', NULL, NULL, '2025-12-09 19:04:17.987+00', '2025-12-09 19:04:18.092554+00', NULL),
('d6afda7d-352a-4d6d-9ff8-cd9a8d94faa5', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '18d814e5-5244-4a27-a4c3-8dd00304cdf4', 'member', 'cs', 'active', NULL, NULL, '2025-12-08 15:18:54.32+00', '2025-12-08 15:18:54.406355+00', NULL),
('ebe6a425-5e99-4ae3-ae63-bde04bb75e3f', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '1e837442-e0bf-4df5-8cf0-3750de4fecdc', 'member', 'manager', 'active', NULL, NULL, '2025-12-05 14:04:15.067488+00', '2025-12-05 14:04:15.067488+00', NULL),
('34344109-78e7-40b5-a7b8-3467c4f2c000', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '287d4a52-b182-4d7d-9429-bb0b1f8f9b61', 'member', 'sales', 'active', NULL, NULL, '2025-12-05 14:04:15.067488+00', '2025-12-05 14:04:15.067488+00', NULL),
('00e22d01-c533-4c7f-bc1f-c9444749389c', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '91055957-8270-45aa-a452-2045daa893ee', 'member', 'sales', 'active', NULL, NULL, '2025-12-05 14:04:15.067488+00', '2025-12-05 14:04:15.067488+00', NULL),
('b3949556-cb80-47a9-9a51-a6501fadb1b6', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'deb0b602-a5c8-4dcc-a814-225d6aa04227', 'member', 'sales', 'active', NULL, NULL, '2025-12-05 14:04:15.067488+00', '2025-12-05 14:04:15.067488+00', NULL);

-- =====================================================
-- TABLE: teams
-- =====================================================
INSERT INTO teams (id, organization_id, name, description, color, manager_id, parent_team_id, monthly_goal, visibility_scope, created_at, updated_at) VALUES
('76754d99-d3c9-426c-991f-7d1cdac600be', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Comercial LEGAL', NULL, '#6366f1', '1e837442-e0bf-4df5-8cf0-3750de4fecdc', NULL, 180000.00, 'team', '2025-12-12 01:54:35.546538+00', '2025-12-12 01:54:35.546538+00');

-- =====================================================
-- TABLE: team_members
-- =====================================================
INSERT INTO team_members (id, team_id, user_id, organization_id, role, created_at, updated_at) VALUES
('f684fb15-ac65-41c5-a04a-36d771e3e1e2', '76754d99-d3c9-426c-991f-7d1cdac600be', '287d4a52-b182-4d7d-9429-bb0b1f8f9b61', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'member', '2025-12-12 01:54:42.730987+00', '2025-12-12 01:54:42.730987+00'),
('a88e2c71-18b0-4d99-891c-029b86431fe8', '76754d99-d3c9-426c-991f-7d1cdac600be', '91055957-8270-45aa-a452-2045daa893ee', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'member', '2025-12-12 01:54:47.161039+00', '2025-12-12 01:54:47.161039+00'),
('a8374309-ffa9-4fef-9486-cf041e4f1582', '76754d99-d3c9-426c-991f-7d1cdac600be', 'deb0b602-a5c8-4dcc-a814-225d6aa04227', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'member', '2025-12-12 01:54:50.880712+00', '2025-12-12 01:54:50.880712+00'),
('7a913371-b4e5-4628-b507-d3f43823dc3a', '76754d99-d3c9-426c-991f-7d1cdac600be', '18d814e5-5244-4a27-a4c3-8dd00304cdf4', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'member', '2025-12-16 18:50:40.729007+00', '2025-12-16 18:50:40.729007+00');

-- =====================================================
-- TABLE: products
-- =====================================================
INSERT INTO products (id, organization_id, name, code, reference, type, category_id, price, cost, monthly_price, billing_type, billing_cycle, minimum_contract_months, unit, active, counts_for_commission, ipi_percent, created_at, updated_at, deleted_at) VALUES
('a5158959-a0fa-44b2-ab58-b01330a92048', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Speedy Quantum', 'SPD-QUANTUM', 'SPD-QUANTUM', 'produto', '8c3960c2-642b-4920-98c9-35a91efd1a8c', 0, 0.00, NULL, 'one_time', 'monthly', 12, 'dia', true, true, 0.00, '2025-12-02 20:31:55.705954+00', '2025-12-02 20:31:55.705954+00', NULL),
('fdc72a25-8d49-4f85-90b8-a0eccf82b817', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'APP BLUE – Setup', 'APP-BLUE-PREM', 'ALABP', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 600, 180.00, NULL, 'one_time', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:31:56.861454+00', '2025-12-02 20:31:56.861454+00', NULL),
('6aaf86bf-d45f-4714-91bb-efb6f97305e8', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Logística Operacional de Campo', 'LOG-OP-CAMPO', 'REPLOG', 'servico', '8c3960c2-642b-4920-98c9-35a91efd1a8c', 0, 0.00, NULL, 'one_time', 'monthly', 12, 'un', true, false, 0.00, '2025-12-02 20:31:57.459715+00', '2025-12-02 20:31:57.459715+00', NULL),
('7c600a6d-9da7-4312-a367-879bb35831b4', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Fast Delivery (Motoboy)', '', 'ALFD', 'servico', '8c3960c2-642b-4920-98c9-35a91efd1a8c', 150, 80.00, NULL, 'one_time', 'monthly', 12, 'un', true, false, 0.00, '2025-12-02 20:31:58.03256+00', '2025-12-02 20:31:58.03256+00', NULL),
('f33c876d-781b-4a8f-9910-6e4ab539825e', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Frete Correios (SEDEX / PAC)', '', 'ALFC', 'servico', '8c3960c2-642b-4920-98c9-35a91efd1a8c', 150, 100.00, NULL, 'one_time', 'monthly', 12, 'un', true, false, 0.00, '2025-12-02 20:31:58.610623+00', '2025-12-02 20:31:58.610623+00', NULL),
('62164a07-c382-4317-9076-c40038233815', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'INFRA BLUE (Instalação Técnica)', '', 'ALIB', 'servico', '8c3960c2-642b-4920-98c9-35a91efd1a8c', 400, 234.00, NULL, 'one_time', 'monthly', 12, 'Pto', true, true, 0.00, '2025-12-02 20:32:05.509099+00', '2025-12-02 20:32:05.509099+00', NULL),
('a15aca94-83a3-4981-9970-736a278c8887', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'VT BLUE – Visita Técnica de Validação', 'ALVTB', 'ALVTB', 'servico', '8c3960c2-642b-4920-98c9-35a91efd1a8c', 400, 180.00, NULL, 'one_time', 'monthly', 12, 'VT', true, true, 0.00, '2025-12-02 20:32:06.057772+00', '2025-12-02 20:32:06.057772+00', NULL),
('4478ac53-5f50-465c-a996-7b3182c1a338', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '4BLACK – 100GB | Sem Fidelidade', '4BL-100-SF', '4BP3SF', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 299.9, 154.60, 299.9, 'recurring', 'monthly', 1, 'un', true, true, 0.00, '2025-12-02 20:32:09.963872+00', '2025-12-02 20:32:09.963872+00', NULL),
('7653b46b-32a5-4e28-bc69-ae77c8bbf35e', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Speedy Boost - Sem Fidelidade', '', 'ASFP2300GB', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 1000, 383.00, 1000, 'recurring', 'monthly', 1, 'un', true, true, 0.00, '2025-12-02 20:32:15.049635+00', '2025-12-02 20:32:15.049635+00', NULL),
('b3cefac1-8089-4eda-a5be-2cb1b2763a50', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'BLUE6 (Sem Fidelidade)', NULL, 'ALB6SF', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 300, 97.00, NULL, 'one_time', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:15.6189+00', '2025-12-02 20:32:15.6189+00', NULL),
('b0a1f7ba-7bfc-41c8-a69d-c9dd1d6ecee6', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'BLUE6 LT (Locação)', NULL, 'ALBL', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 50, 0.00, 50, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:16.189741+00', '2025-12-02 20:32:16.189741+00', NULL),
('b5131983-d45e-4b0e-8f9e-0d9e3f6fd34a', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '4BLACK Plus – 130GB', '4BL-130-CF', '4BP1', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 159.9, 77.30, 159.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:16.771606+00', '2025-12-02 20:32:16.771606+00', NULL),
('d5c5a5dc-f38f-4a0c-915d-af1f5f71baca', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '4BLACK Ultra – 230GB', '4BL-230-CF', '4BP2', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 199.9, 97.00, 199.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:17.343408+00', '2025-12-02 20:32:17.343408+00', NULL),
('4f18b30b-bf63-45a6-b64d-d0cae92fd7d2', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '4BLACK FULL – 100GB', '4BL-100-CF', '4BP3', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 239.9, 116.40, 239.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:17.912127+00', '2025-12-02 20:32:17.912127+00', NULL),
('6fbbe3dd-fbce-40db-bbab-e7b79ce7b534', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '4BLACK Max – 260GB', '4BL-260-CF', '4BP4', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 259.9, 125.70, 259.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:18.474073+00', '2025-12-02 20:32:18.474073+00', NULL),
('d38f9fba-09ec-4927-8b25-3acd0fe7a4fd', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Speedy Flex – 100GB', 'SPD-100-CF', 'ASFP1100GB', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 239.9, 77.30, 239.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:19.026698+00', '2025-12-02 20:32:19.026698+00', NULL),
('09bbc0f9-0cff-4a7d-a11e-4ca60fb8b9f1', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Speedy Flex – 150GB', 'SPD-150-CF', 'ASFP2150GB', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 299.9, 96.80, 299.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:19.565287+00', '2025-12-02 20:32:19.565287+00', NULL),
('0bad6e95-ec42-4edf-ab29-f22105e0d8bb', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Speedy Flex – 300GB', 'SPD-300-CF', 'ASFP3300GB', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 399.9, 213.30, 399.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:20.098541+00', '2025-12-02 20:32:20.098541+00', NULL),
('d0e8d27e-0cca-45de-8dc0-9f12c90b10f6', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Speedy Flex – 500GB', 'SPD-500-CF', 'ASFP4500GB', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 499.9, 213.30, 499.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:20.66048+00', '2025-12-02 20:32:20.66048+00', NULL),
('2c4d6c71-f33a-4f6a-9b60-7bd2a2e7ff1b', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Speedy Boost – 300GB', 'SPD-BOOST-300', 'ASFP5300GB', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 599.9, 280.00, 599.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:21.213063+00', '2025-12-02 20:32:21.213063+00', NULL),
('5bc7e00e-0cf1-4b6e-a29a-3d3ffc8f6c08', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Speedy Ultra – 500GB', 'SPD-ULTRA-500', 'ASFP6500GB', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 799.9, 383.00, 799.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:21.780088+00', '2025-12-02 20:32:21.780088+00', NULL),
('f1c5a4fc-b9a3-49d5-a07a-db2efa3aa40e', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Speedy Prime – 1TB', 'SPD-PRIME-1TB', 'ASFP71TB', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 1199.9, 660.00, 1199.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:22.310827+00', '2025-12-02 20:32:22.310827+00', NULL),
('29bb38e5-3e3b-4cce-8f6f-8e54f85db77e', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'IP Fixo Público (IPv4)', 'IP-FIXO', 'ALIP4', 'servico', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 119.9, 50.00, 119.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:22.837579+00', '2025-12-02 20:32:22.837579+00', NULL),
('75dd0d3b-b795-45d0-99c2-0b0c1aeb06ee', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Chip M2M SIM', 'M2M-SIM', 'ALM2M', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 10, 5.00, NULL, 'one_time', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:23.371878+00', '2025-12-02 20:32:23.371878+00', NULL),
('35e768b9-dc5e-4a22-b339-4f34e2f569ac', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Cloud SSD 50GB', 'CLOUD-50', 'ALCLOUD50', 'servico', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 29.9, 10.00, 29.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:23.933346+00', '2025-12-02 20:32:23.933346+00', NULL),
('9de77beb-aa26-4c63-a61a-f8f0f3a54f13', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Cloud SSD 100GB', 'CLOUD-100', 'ALCLOUD100', 'servico', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 49.9, 18.00, 49.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:24.501413+00', '2025-12-02 20:32:24.501413+00', NULL),
('18f5d5fe-2bec-43e4-9a92-df6d94f0e59a', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Cloud SSD 250GB', 'CLOUD-250', 'ALCLOUD250', 'servico', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 79.9, 30.00, 79.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:25.103318+00', '2025-12-02 20:32:25.103318+00', NULL),
('8bb3a2d4-7fd5-4b48-b69b-4d41e44c9e35', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Antena Yagi 25dBi', 'ANT-YAGI-25', 'ALAY25', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 450, 200.00, NULL, 'one_time', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:25.638346+00', '2025-12-02 20:32:25.638346+00', NULL),
('fe94c135-2aca-4a3a-81c9-d11ee6ebc93c', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Antena Parabólica 30dBi', 'ANT-PARA-30', 'ALAP30', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 650, 300.00, NULL, 'one_time', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:26.20374+00', '2025-12-02 20:32:26.20374+00', NULL),
('c77c88cd-06d8-4ec7-8d14-a3e78f6feb4e', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Repetidor de Sinal 4G', 'REP-4G', 'ALREP4G', 'produto', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 1200, 600.00, NULL, 'one_time', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:26.730787+00', '2025-12-02 20:32:26.730787+00', NULL),
('c3a981f9-5a0f-4bd7-8b58-0d33f82db01a', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Consultoria Técnica (hora)', 'CONSULT-HORA', 'ALCONS', 'servico', '8c3960c2-642b-4920-98c9-35a91efd1a8c', 200, 80.00, NULL, 'one_time', 'monthly', 12, 'hora', true, true, 0.00, '2025-12-02 20:32:27.260161+00', '2025-12-02 20:32:27.260161+00', NULL),
('e7746c77-fc14-459e-a96d-46e4c74b0e18', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Suporte Premium 24/7', 'SUP-PREMIUM', 'ALSUP24', 'servico', '8c3960c2-642b-4920-98c9-35a91efd1a8c', 199.9, 50.00, 199.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:27.811127+00', '2025-12-02 20:32:27.811127+00', NULL),
('c5db4a0c-7c5e-4dbe-9f49-77d0ddc6c9a5', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Gestão de Firewall', 'FIREWALL', 'ALFIRE', 'servico', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 149.9, 40.00, 149.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:28.396177+00', '2025-12-02 20:32:28.396177+00', NULL),
('9a79a03b-2a79-4d07-81c0-d9e11f0b9f2a', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'VPN Corporativa', 'VPN-CORP', 'ALVPN', 'servico', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 99.9, 25.00, 99.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:28.950299+00', '2025-12-02 20:32:28.950299+00', NULL),
('d1245cb3-5678-4f9a-b123-456789abcdef', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Backup Cloud 500GB', 'BACKUP-500', 'ALBKP500', 'servico', 'aedaae1f-192a-4cab-ab4a-ef1d9c832001', 179.9, 60.00, 179.9, 'recurring', 'monthly', 12, 'un', true, true, 0.00, '2025-12-02 20:32:29.504212+00', '2025-12-02 20:32:29.504212+00', NULL),
('09773be0-87e6-4388-8cd9-4344c0758993', '774d7d78-8257-4891-aac7-718039b80049', 'Plano Autonomous – NOID RevenueOS', 'NOID-PAUTONOMOUS', 'SUBS-NOID-AUTONOMOUS', 'servico', '3e125b9b-cef4-494f-a91b-896038d11d49', 299.9, 82.00, 299.9, 'recurring', 'monthly', 12, 'User', true, true, 0.00, '2025-12-24 19:13:46.462874+00', '2025-12-24 19:13:46.462874+00', NULL);

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- =====================================================
-- END OF DUMP
-- =====================================================
