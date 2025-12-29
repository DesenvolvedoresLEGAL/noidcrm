-- ============================================================
-- NOID RevenueOS - DATA EXPORT
-- Generated: 2025-12-29
-- ============================================================
-- 
-- IMPORTANT: Run this AFTER running schema_export.sql
-- This file contains all data from the production database
--
-- Order of execution follows foreign key dependencies:
-- 1. Organizations (no dependencies)
-- 2. Profiles (depends on organizations)
-- 3. Business Units (depends on organizations)
-- 4. User Roles (depends on profiles)
-- 5. Sellers (depends on organizations, profiles)
-- 6. Settings (depends on organizations)
-- 7. Product Categories (depends on organizations)
-- 8. Measurement Units (depends on organizations)
-- 9. Origin Groups (depends on organizations)
-- 10. Origins (depends on organizations, origin_groups)
-- 11. Loss Reasons (depends on organizations)
-- 12. Pipelines (depends on organizations)
-- 13. Stages (depends on pipelines)
-- 14. Products (depends on organizations, product_categories)
-- 15. Accounts (depends on organizations)
-- 16. Contacts (depends on accounts)
-- 17. Opportunities (depends on pipelines, stages, accounts, contacts)
-- 18. Proposals (depends on opportunities)
-- 19. Proposal Items (depends on proposals, products)
-- 20. Activities (depends on opportunities, accounts, contacts)
-- 21. Achievements (global)
-- ============================================================

-- Disable triggers temporarily for faster import
SET session_replication_role = 'replica';

-- ============================================================
-- 1. ORGANIZATIONS
-- ============================================================

INSERT INTO organizations (id, name, slug, cnpj, status, industry, team_size, acquisition_channel, billing_cycle, current_plan_id, is_plan_locked, max_opportunities, max_users, active_seats, proposal_prefix, proposal_sequence, proposal_validity_days, default_currency, primary_color, goal_system_mode, calculated_mrr, calculated_arr, trial_ends_at, address_street, address_number, address_complement, address_city, address_state, address_zip, phone, email, website, logo_url, legal_name, created_at, updated_at)
VALUES 
  ('1b02e04f-9dde-48ff-abe9-392cbe981a2e', 'Opus Bobinas', 'opus-bobinas', '59336028000147', 'active', 'Outro', '2-5 pessoas', 'slg', 'monthly', 'neural', true, 100, NULL, 1, 'PROP', 0, 30, 'BRL', '#000000', 'ote', 199.90, 2398.80, '2026-01-09 17:05:38.506+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-26 17:05:38.651471+00', '2025-12-26 17:05:38.651471+00'),
  ('8c58f8e4-be79-46c5-9d1f-bff53851627b', 'Cloud Marketing Digital', 'cloud-marketing-digital', '21.310.716/0001-65', 'trial', 'Marketing e Publicidade', '2-5 pessoas', 'plg', 'monthly', NULL, false, 100, 5, 0, 'PROP', 0, 30, 'BRL', '#000000', 'ote', 0.00, 0.00, '2025-12-25 12:00:31.213+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-11 12:00:31.297404+00', '2025-12-11 12:00:31.297404+00'),
  ('d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'LEGAL', 'operadoralegal', '54753156000172', 'active', 'Tecnologia', '11-50', 'plg', 'monthly', 'internal_full', true, 100, 5, 10, 'PROP', 269, 7, 'BRL', '#020cbc', 'simple', 0.00, 0.00, NULL, 'Rua Salvador Simões', '801', '12º Andar Cjs. 1201/1210', 'São Paulo', 'SP', '04276000', '11981254115', 'sos@operadora.legal', 'https://operadora.legal', 'https://urihdqturaebhiefwjnw.supabase.co/storage/v1/object/public/organization-logos/d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d/logo.png', 'Operadora LEGAL X LTDA', '2025-10-26 19:19:04.109015+00', '2025-10-26 19:19:04.109015+00'),
  ('774d7d78-8257-4891-aac7-718039b80049', 'Humanoid', 'humanoid', NULL, 'active', 'Tecnologia', '2-5 pessoas', 'internal', 'monthly', 'internal_full', true, 100, NULL, 5, 'PROP', 9, 30, 'BRL', '#000000', 'ote', 0.00, 0.00, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-10 09:26:26.262711+00', '2025-12-10 09:26:26.262711+00'),
  ('a8ccf8c7-dbea-41b1-adc2-0285999d1a33', 'Victor Mazuchi Test', 'victor-mazuchi-test', NULL, 'trial', 'SaaS / Software', '2-5 pessoas', 'plg', 'monthly', NULL, false, 100, 5, 0, 'PROP', 1, 30, 'BRL', '#000000', 'ote', 0.00, 0.00, '2025-12-26 16:28:50.711+00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2025-12-12 16:28:50.795538+00', '2025-12-12 16:28:50.795538+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. BUSINESS UNITS
-- ============================================================

INSERT INTO business_units (id, organization_id, code, name, color, is_active, created_at, updated_at)
VALUES
  ('da9b1d09-cc7d-4e17-8542-88415121c3b2', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'CS', 'ALUGUE: CS', '#3b82f6', false, '2025-10-31 17:19:48.558624+00', '2025-10-31 18:06:11.941063+00'),
  ('a6837e42-58cf-4965-8cf8-9fdc06260908', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'FINANCEIRO', 'FINANCEIRO', '#3b82f6', false, '2025-10-31 17:20:12.21626+00', '2025-10-31 18:06:23.300053+00'),
  ('f6926de2-d781-4de3-a984-300cd157c634', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'PREVENDAS', 'PRÉ VENDAS', '#3b82f6', false, '2025-10-31 17:19:36.444323+00', '2025-10-31 18:06:44.409988+00'),
  ('fda721e2-4e16-44fa-8557-934484e64f38', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'SALES', 'ALUGUE: VENDAS', '#6366f1', false, '2025-10-31 17:00:56.169447+00', '2025-10-31 18:06:47.340991+00'),
  ('3ee83286-0f0b-4836-a57c-08cd9a3bf237', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'BUALU', 'ALUGUE', '#3b82f6', true, '2025-10-31 18:07:01.739933+00', '2025-10-31 18:07:01.739933+00'),
  ('1ecb65ba-01fd-4e86-b2f9-127956b307dd', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'AERO', 'AERO', '#3b82f6', true, '2025-10-31 18:07:12.671718+00', '2025-10-31 18:07:12.671718+00'),
  ('ab3a8afa-47fb-4d43-ba80-dd55a8a08871', '774d7d78-8257-4891-aac7-718039b80049', 'HUMANOID', 'Humanoid', '#020cbc', true, '2025-12-10 19:38:12.499815+00', '2025-12-10 19:38:12.499815+00'),
  ('e448d19d-4d29-4608-ac61-57a5128c4ae0', '1b02e04f-9dde-48ff-abe9-392cbe981a2e', 'BOBINAS', 'bobinas', '#3b82f6', true, '2025-12-26 17:13:10.614422+00', '2025-12-26 17:13:10.614422+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. PRODUCT CATEGORIES
-- ============================================================

INSERT INTO product_categories (id, organization_id, name, color, is_active, created_at, updated_at)
VALUES
  ('8c3960c2-642b-4920-98c9-35a91efd1a8c', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'ALUGUE', '#3b82f6', true, '2025-12-02 20:31:55.513582+00', '2025-12-02 20:31:55.513582+00'),
  ('5ff39c62-c0a5-401a-8397-1eb73b3da073', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'AERO', '#3b82f6', true, '2025-12-02 20:31:59.482548+00', '2025-12-02 20:31:59.482548+00'),
  ('aedaae1f-192a-4cab-ab4a-ef1d9c832001', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'ASSINATURA', '#3b82f6', true, '2025-12-02 20:32:00.225617+00', '2025-12-02 20:32:00.225617+00'),
  ('3e125b9b-cef4-494f-a91b-896038d11d49', '774d7d78-8257-4891-aac7-718039b80049', 'SaaS – Planos & Assinaturas', '#3b82f6', true, '2025-12-11 19:14:46.096184+00', '2025-12-11 19:23:07.59418+00'),
  ('37760765-d98a-4d9a-825d-7c5904fa4dce', '774d7d78-8257-4891-aac7-718039b80049', 'Serviços – Setup & Implantação', '#3b82f6', true, '2025-12-11 19:14:23.00583+00', '2025-12-11 19:23:17.098354+00'),
  ('e1cf40ab-c03f-4e64-ab22-319460e848cd', '774d7d78-8257-4891-aac7-718039b80049', 'Consultoria & Business Intelligence', '#3b82f6', true, '2025-12-11 19:14:32.659823+00', '2025-12-11 19:23:26.465154+00'),
  ('15bc920a-739a-4671-9e1a-570ab7e1b45d', '774d7d78-8257-4891-aac7-718039b80049', 'IA – Créditos & Automação (VOLTS)', '#3b82f6', true, '2025-12-11 19:14:12.416477+00', '2025-12-11 19:23:36.178232+00'),
  ('386b9495-7dce-40e3-a078-757705c3f07b', '774d7d78-8257-4891-aac7-718039b80049', 'Smart Events', '#3b82f6', true, '2025-12-11 19:13:03.945787+00', '2025-12-11 19:23:49.01618+00'),
  ('a699dd16-9393-4296-82fa-81a05f5c898b', '1b02e04f-9dde-48ff-abe9-392cbe981a2e', 'Bobina Térmica', '#3b82f6', true, '2025-12-26 17:53:37.908849+00', '2025-12-26 17:53:37.908849+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. MEASUREMENT UNITS
-- ============================================================

INSERT INTO measurement_units (id, organization_id, name, abbreviation, is_active, is_default, created_at, updated_at)
VALUES
  ('ebdf8527-fdc0-4a2b-90c0-9ef99ec6cf16', '774d7d78-8257-4891-aac7-718039b80049', 'Usuário', 'User', true, false, '2025-12-11 19:12:45.18912+00', '2025-12-11 19:12:45.18912+00'),
  ('7902d81e-e0fd-4749-ac14-e503fc78624e', '774d7d78-8257-4891-aac7-718039b80049', 'Hora', 'Hr', true, false, '2025-12-11 19:14:59.386308+00', '2025-12-11 19:21:39.581741+00'),
  ('319b01b9-f6f0-4768-9381-b2402ae240ef', '774d7d78-8257-4891-aac7-718039b80049', 'Mensal', 'Mês', true, false, '2025-12-11 19:21:31.888127+00', '2025-12-11 19:21:45.062443+00'),
  ('2309a01a-1c11-4dc2-91f3-6172e9a20fd5', '774d7d78-8257-4891-aac7-718039b80049', 'Anual', 'Ano', true, false, '2025-12-11 19:21:54.855377+00', '2025-12-11 19:21:54.855377+00'),
  ('46ba221b-5e1e-4596-8631-943e2e9716df', '774d7d78-8257-4891-aac7-718039b80049', 'Licença', 'Lic', true, false, '2025-12-11 19:22:06.509324+00', '2025-12-11 19:22:06.509324+00'),
  ('6ebe44ba-e83e-47a2-ab55-e690d9a2e83b', '774d7d78-8257-4891-aac7-718039b80049', 'Volts', 'VLT', true, false, '2025-12-11 19:22:26.488246+00', '2025-12-11 19:22:26.488246+00'),
  ('79fce057-f5b5-4c5b-9a76-a80d91e1b406', '774d7d78-8257-4891-aac7-718039b80049', 'Serviço', 'SRV', true, false, '2025-12-11 19:38:15.407383+00', '2025-12-11 19:38:15.407383+00'),
  ('d1a4df96-6f32-4104-9b13-3688ed3d71ce', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Dia', 'dia', true, false, '2025-12-02 21:06:48.457275+00', '2025-12-22 20:49:08.092767+00'),
  ('c963c256-8d72-414c-95bb-2dafcd508a26', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Ponto(s)', 'Pto', true, false, '2025-12-02 21:24:15.70235+00', '2025-12-22 20:49:08.092767+00'),
  ('88ac153a-9de3-4325-99b1-61c99126480c', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Unidade', 'Un', true, true, '2025-12-02 21:06:48.457275+00', '2025-12-22 20:49:08.362439+00'),
  ('32591d3e-b995-48d8-9593-f6ea87ba11c7', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Hora(s)', 'H', true, false, '2025-12-22 20:48:59.521386+00', '2025-12-22 20:49:14.092224+00'),
  ('9bb71e93-c434-4fe8-9d83-ef89f08455b7', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Metro', 'M', true, false, '2025-12-22 14:01:43.008696+00', '2025-12-22 20:49:18.972921+00'),
  ('cd7befcf-ea3e-425d-a8a9-a3f19d23b633', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Metro²', 'M²', true, false, '2025-12-02 21:06:48.457275+00', '2025-12-22 20:49:25.261707+00'),
  ('b1331291-18a2-4d8c-99ab-f42abf84e40c', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Visita', 'VT', true, false, '2025-12-22 21:28:00.961162+00', '2025-12-22 21:28:00.961162+00'),
  ('11cabd8e-f47b-40a5-9513-dbaca8713ad7', '1b02e04f-9dde-48ff-abe9-392cbe981a2e', 'Metro', 'M', true, true, '2025-12-26 17:53:54.706005+00', '2025-12-26 17:53:54.706005+00'),
  ('2a38b95e-e1a1-4f47-a73f-2b21bcc8ea7f', '1b02e04f-9dde-48ff-abe9-392cbe981a2e', 'Caixa', 'Cx', true, false, '2025-12-26 17:57:00.94684+00', '2025-12-26 17:57:00.94684+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. ORIGIN GROUPS
-- ============================================================

INSERT INTO origin_groups (id, organization_id, name, description, is_active, created_at, updated_at)
VALUES
  ('a9b154c4-7704-46ff-8aaf-4fbd07141786', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Farmers', 'Clientes que já existem na base e podem gerar novas oportunidades', true, '2025-11-25 19:27:49.494401+00', '2025-11-25 19:27:49.494401+00'),
  ('6e527f12-f8c1-4e29-afa1-6c910a0bcf54', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Inbound', '', true, '2025-12-05 16:05:26.650012+00', '2025-12-05 16:05:26.650012+00'),
  ('1c85526e-f0a5-43e5-bc7b-2f8ad2cc9993', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Outbound', '', true, '2025-12-05 16:05:32.907436+00', '2025-12-05 16:05:32.907436+00'),
  ('cf49a229-b88c-4bc4-aa87-66ed25e97e40', '774d7d78-8257-4891-aac7-718039b80049', 'Farmer', '', true, '2025-12-11 16:00:44.91277+00', '2025-12-11 16:00:44.91277+00'),
  ('3078a8ea-68e0-4c7c-b3a9-7d0ad51317ef', '774d7d78-8257-4891-aac7-718039b80049', 'Inbound', '', true, '2025-12-11 16:00:50.817085+00', '2025-12-11 16:00:50.817085+00'),
  ('df5733fd-1c60-483c-b419-3d0ea0963863', '774d7d78-8257-4891-aac7-718039b80049', 'Outbound', '', true, '2025-12-11 16:00:56.12131+00', '2025-12-11 16:01:00.842455+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. ORIGINS
-- ============================================================

INSERT INTO origins (id, organization_id, group_id, name, description, is_active, created_at, updated_at)
VALUES
  ('baba6702-1312-4f0b-8907-29b9d8571e88', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '6e527f12-f8c1-4e29-afa1-6c910a0bcf54', 'Google Ads', '', true, '2025-12-05 17:18:42.959804+00', '2025-12-05 17:18:42.959804+00'),
  ('d17a59eb-8d3a-443e-83cf-6c6c1461a4fe', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '1c85526e-f0a5-43e5-bc7b-2f8ad2cc9993', 'Apollo > WhatsApp', '', true, '2025-12-09 20:19:37.375612+00', '2025-12-09 20:19:37.375612+00'),
  ('075df2c0-becc-4e13-b309-577bdfaf2610', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'a9b154c4-7704-46ff-8aaf-4fbd07141786', 'Carteira - Contato Receptivo', '', true, '2025-12-09 20:20:00.524462+00', '2025-12-09 20:20:00.524462+00'),
  ('db1c1d85-3ddf-40a9-ae8a-6c97bd5bf843', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '1c85526e-f0a5-43e5-bc7b-2f8ad2cc9993', 'E-mail Marketing', '', true, '2025-12-09 20:20:13.011725+00', '2025-12-09 20:20:13.011725+00'),
  ('34200739-5f3e-4a07-bb09-31eb0674cc81', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '1c85526e-f0a5-43e5-bc7b-2f8ad2cc9993', 'Evento Presencial', '', true, '2025-12-09 20:20:36.261173+00', '2025-12-09 20:20:36.261173+00'),
  ('b3c62373-4c1d-4e30-b945-d427b3a77fde', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '1c85526e-f0a5-43e5-bc7b-2f8ad2cc9993', 'Ligação', '', true, '2025-12-09 20:21:04.553962+00', '2025-12-09 20:21:04.553962+00'),
  ('e4e8fa45-b67f-401b-8881-2c11ad53144f', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '1c85526e-f0a5-43e5-bc7b-2f8ad2cc9993', 'Prospecção > Grupo WhatsApp', '', true, '2025-12-09 20:21:37.395245+00', '2025-12-09 20:21:37.395245+00'),
  ('dfa5cddb-07f5-48f1-b81a-2626556e344f', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '1c85526e-f0a5-43e5-bc7b-2f8ad2cc9993', 'LinkedIn', '', true, '2025-12-09 20:22:47.651889+00', '2025-12-09 20:22:47.651889+00'),
  ('9f9c8a15-ec6a-4480-89aa-d050bf7d9b63', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '1c85526e-f0a5-43e5-bc7b-2f8ad2cc9993', 'Apollo > Ligação', '', true, '2025-12-09 20:19:27.472709+00', '2025-12-09 20:19:27.472709+00'),
  ('ba097639-8033-40e4-9215-c590f8be5ad8', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'a9b154c4-7704-46ff-8aaf-4fbd07141786', 'Carteira - Contato Ativo', '', true, '2025-12-09 20:19:49.369385+00', '2025-12-09 20:19:49.369385+00'),
  ('131eac84-1577-4b95-9dde-415ae2858ab1', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '6e527f12-f8c1-4e29-afa1-6c910a0bcf54', 'Indicação', '', true, '2025-12-09 20:20:51.933801+00', '2025-12-09 20:20:51.933801+00'),
  ('379458f7-97a3-47a9-b789-88445b3a74d5', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '6e527f12-f8c1-4e29-afa1-6c910a0bcf54', 'Meta ADS', '', true, '2025-12-09 20:21:20.191661+00', '2025-12-09 20:21:20.191661+00'),
  ('0a16890d-6f69-4001-a8d5-2952aa244ce7', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', '1c85526e-f0a5-43e5-bc7b-2f8ad2cc9993', 'WhatsApp', '', true, '2025-12-09 20:21:52.134892+00', '2025-12-09 20:21:52.134892+00'),
  ('06490bb8-4e1e-4b94-adf5-f9349e250724', '774d7d78-8257-4891-aac7-718039b80049', '3078a8ea-68e0-4c7c-b3a9-7d0ad51317ef', 'Instagram CEO', '', true, '2025-12-11 16:01:24.875746+00', '2025-12-11 16:01:24.875746+00'),
  ('3c1937bc-7af2-4f88-ae1c-8188ec8225e8', '774d7d78-8257-4891-aac7-718039b80049', '3078a8ea-68e0-4c7c-b3a9-7d0ad51317ef', 'Instagram Company', '', true, '2025-12-11 16:01:47.527595+00', '2025-12-11 16:01:47.527595+00'),
  ('27170519-fd68-406e-bb2a-35494f38cc22', '774d7d78-8257-4891-aac7-718039b80049', 'df5733fd-1c60-483c-b419-3d0ea0963863', 'Ligação', '', true, '2025-12-11 16:02:06.112648+00', '2025-12-11 16:02:06.112648+00'),
  ('fa829c35-8dbb-4fcb-888c-dffa68103a58', '1b02e04f-9dde-48ff-abe9-392cbe981a2e', NULL, 'Indicação', '', true, '2025-12-26 18:13:27.17171+00', '2025-12-26 18:13:27.17171+00'),
  ('5f966a6c-a769-4d3f-9361-775427b59320', '774d7d78-8257-4891-aac7-718039b80049', '3078a8ea-68e0-4c7c-b3a9-7d0ad51317ef', 'LP Noid', '', true, '2025-12-27 00:26:19.238344+00', '2025-12-27 00:26:19.238344+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. LOSS REASONS
-- ============================================================

INSERT INTO loss_reasons (id, organization_id, name, is_active, pipeline_ids, created_at, updated_at)
VALUES
  ('61b4e2fb-2cb4-4c29-9239-6934fe9f18cf', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Cliente não entendeu/valorizou a solução', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('36e62f1d-40ba-4596-9d90-c67b2991879f', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Entrou em contato apenas para pesquisa de preços', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('08e53484-d32a-4beb-9341-7f72da9d469d', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Cliente optou por solução concorrente', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('e20d0c25-3032-41b4-986a-e5381d361af0', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Falta de fit entre necessidade e nossa solução', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('0407ae18-f07b-4932-a106-2d2ca5720db3', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Falha na comunicação interna do cliente', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('9b56f0fe-adb0-4407-a567-32a119a7583f', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Cliente não possui viabilidade operacional', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('17bee1ce-0391-4b06-bff0-1dd55cb24fbc', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Expectativa de ROI não foi atingida', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('875a74ef-4c42-40a9-8290-3b26668983cd', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Falta de apoio da alta gerência do cliente', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('dbcd9b13-027e-4759-bc6d-2691b41169cf', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Falta de disponibilidade de equipamentos', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('c2be2808-fd85-49e7-b97b-e466cca9672a', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Não houve budget aprovado', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('f3ed85e9-1cf4-4fd7-ad65-6c5e0b66b718', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Preço percebido como alto', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('dc9b6c3f-f784-4652-ad4c-afee831a083a', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Restrições de tempo para implementação', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('b0247516-32a0-44ea-828c-02dee2d3cb4e', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Timing inadequado para o cliente', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('7c266dad-e680-4ba0-9372-8e7823ff3f03', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Necessidade não urgente/não prioritária', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('7b449dc8-e894-4550-882d-bd172442a83c', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Mudança de prioridades do cliente', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('9ed5d743-1eae-47e9-95c1-066c67fadaa5', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Não conseguimos agendar reunião de vendas', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('4c341d66-4514-4a1d-99c7-8c1bcd8f62e0', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Período de safra ou sazonalidade desfavorável', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00'),
  ('4ec962c1-9635-494a-a2f4-ba0c958076ea', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'Tomador de decisão não identificado/acessado', true, NULL, '2025-11-25 19:46:18.078775+00', '2025-12-18 11:37:48.673513+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 8. PIPELINES
-- ============================================================

INSERT INTO pipelines (id, organization_id, name, pipeline_type, type, color, business_unit_ids, created_at)
VALUES
  ('774d7d78-8257-4891-aac7-718039b80049-sales-1', '774d7d78-8257-4891-aac7-718039b80049', 'PRÉ VENDAS', 'qualification', 'sales', NULL, ARRAY['ab3a8afa-47fb-4d43-ba80-dd55a8a08871']::uuid[], '2025-12-10 09:26:26.763008+00'),
  ('95ce0403-acab-497c-a9cd-c8c95a2c36d0', '774d7d78-8257-4891-aac7-718039b80049', 'VENDAS', 'sales', 'CUSTOM', NULL, ARRAY['ab3a8afa-47fb-4d43-ba80-dd55a8a08871']::uuid[], '2025-12-11 13:36:19.233433+00'),
  ('8be179ed-fa2d-4a64-9fe0-9283dc288717', '774d7d78-8257-4891-aac7-718039b80049', 'ONBOARDING CS', 'onboarding', 'CUSTOM', NULL, ARRAY['ab3a8afa-47fb-4d43-ba80-dd55a8a08871']::uuid[], '2025-12-11 15:31:09.380823+00'),
  ('a62e6a8a-1c60-4b6e-bdb7-00464d69d692', '774d7d78-8257-4891-aac7-718039b80049', 'EXPANSÃO', 'renewal', 'CUSTOM', NULL, ARRAY['ab3a8afa-47fb-4d43-ba80-dd55a8a08871']::uuid[], '2025-12-11 15:47:07.44479+00'),
  ('59a4780d-0b92-4a48-be49-ee490be93dbf', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'VENDAS', 'sales', 'fda721e2-4e16-44fa-8557-934484e64f38', NULL, ARRAY['fda721e2-4e16-44fa-8557-934484e64f38', '3ee83286-0f0b-4836-a57c-08cd9a3bf237']::uuid[], '2025-10-31 18:00:44.360845+00'),
  ('4f454385-5bb2-436b-af52-1fd69564af95', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'PÓS VENDA', 'renewal', 'CUSTOM', NULL, ARRAY['3ee83286-0f0b-4836-a57c-08cd9a3bf237']::uuid[], '2025-12-15 11:30:32.776803+00'),
  ('97a78715-c2e5-426c-b248-979b7718af03', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'OPERACIONAL', 'onboarding', 'CUSTOM', NULL, ARRAY['3ee83286-0f0b-4836-a57c-08cd9a3bf237']::uuid[], '2025-11-24 15:22:55.076835+00'),
  ('d1b68a0f-4e2a-48ce-a03d-19c2751f5f2d-sales-1', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'PRÉ VENDAS', 'qualification', 'f6926de2-d781-4de3-a984-300cd157c634', NULL, ARRAY['f6926de2-d781-4de3-a984-300cd157c634', '3ee83286-0f0b-4836-a57c-08cd9a3bf237', '1ecb65ba-01fd-4e86-b2f9-127956b307dd']::uuid[], '2025-10-26 19:19:04.540678+00'),
  ('dbff5270-754e-40c0-9b56-ab4c4d601124', '1b02e04f-9dde-48ff-abe9-392cbe981a2e', 'PRÉ VENDAS', 'qualification', 'CUSTOM', NULL, ARRAY['e448d19d-4d29-4608-ac61-57a5128c4ae0']::uuid[], '2025-12-26 18:10:41.343644+00'),
  ('8c58f8e4-be79-46c5-9d1f-bff53851627b-sales-1', '8c58f8e4-be79-46c5-9d1f-bff53851627b', 'Vendas B2B', 'sales', 'sales', NULL, ARRAY[]::uuid[], '2025-12-11 12:00:31.795351+00'),
  ('a8ccf8c7-dbea-41b1-adc2-0285999d1a33-sales-1', 'a8ccf8c7-dbea-41b1-adc2-0285999d1a33', 'Vendas B2B', 'sales', 'sales', NULL, ARRAY[]::uuid[], '2025-12-12 16:28:51.149638+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 9. ACHIEVEMENTS (Global)
-- ============================================================

INSERT INTO achievements (id, code, name, description, category, target_value, xp_reward, icon, is_active, organization_id, created_at)
VALUES
  ('6764927c-9c4d-4aff-99aa-5a8def1d84ca', 'sessions_25', 'Treinador Dedicado', 'Complete 25 sessões de roleplay', 'milestone', 25, 150, 'dumbbell', true, NULL, '2025-12-03 22:47:01.797556+00'),
  ('05a0f652-4478-40d8-af7a-87511bb964df', 'sessions_100', 'Mestre do Treino', 'Complete 100 sessões de roleplay', 'milestone', 100, 500, 'trophy', true, NULL, '2025-12-03 22:47:01.797556+00'),
  ('f0a6a28f-567e-409c-bda3-315118e5f578', 'streak_30', 'Consistência Inabalável', 'Mantenha um streak de 30 dias', 'milestone', 30, 400, 'flame', true, NULL, '2025-12-03 22:47:01.797556+00'),
  ('885d77f5-da6b-4ad2-8b5a-21c3a2ba074b', 'avg_score_85', 'Vendedor de Elite', 'Alcance média geral de 8.5', 'milestone', 85, 300, 'star', true, NULL, '2025-12-03 22:47:01.797556+00'),
  ('61369171-9ef8-4a2e-8970-6e882dac74a8', 'weekly_5', 'Semana Produtiva', 'Complete 5 treinos nesta semana', 'weekly', 5, 75, 'calendar', true, NULL, '2025-12-03 22:47:01.797556+00'),
  ('2bae26a9-3463-49b4-ab9e-a68a495148c1', 'weekly_perfect', 'Semana Perfeita', 'Seja aprovado em todos os treinos da semana', 'weekly', 7, 150, 'check-circle', true, NULL, '2025-12-03 22:47:01.797556+00'),
  ('988cccf0-cd0a-445e-a8ea-ddc33e6d52dd', 'monthly_20', 'Mês Intenso', 'Complete 20 treinos este mês', 'monthly', 20, 200, 'calendar-days', true, NULL, '2025-12-03 22:47:01.797556+00'),
  ('b7469c81-7060-4fbf-8fd3-6525a46c0a8a', 'monthly_champion', 'Campeão do Mês', 'Seja o vendedor com mais XP no mês', 'monthly', 1, 500, 'crown', true, NULL, '2025-12-03 22:47:01.797556+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 10. SETTINGS
-- ============================================================

INSERT INTO settings (id, organization_id, section, key, value, user_id, created_at, updated_at)
VALUES
  ('562379be-b72f-4140-a3fc-3f7bb07124ea', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'roleplay', 'training_window', '{"end": "09:00", "start": "08:30", "timezone": "America/Sao_Paulo"}', NULL, '2025-10-27 09:37:04.86529+00', '2025-10-27 09:37:04.86529+00'),
  ('eed4308a-bbf0-40f5-9c0e-4cd15bf518c9', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'roleplay', 'performance_gate', '{"active": true, "min_score": 8, "window_sessions": 5}', NULL, '2025-10-27 09:37:04.86529+00', '2025-10-27 09:37:04.86529+00'),
  ('70e8ae80-cf4d-41ec-8032-36a5fec02a5b', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'roleplay', 'ranking_settings', '{"top_count": 10, "show_public": true, "show_top_only": false, "update_period_days": 7}', NULL, '2025-10-27 09:37:04.86529+00', '2025-10-27 09:37:04.86529+00')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- IMPORTANT NOTES
-- ============================================================
-- 
-- The following tables contain large amounts of data that need 
-- to be exported separately due to size constraints:
-- 
-- - profiles (user data - requires auth.users to be created first)
-- - accounts (670+ records)
-- - contacts (100+ records)
-- - opportunities (100+ records)
-- - proposals (30+ records)
-- - proposal_items (100+ records)
-- - activities (90+ records)
-- - stages (140+ records)
-- - products (50+ records)
-- - sellers (15+ records)
-- - user_roles (30+ records)
--
-- To export these tables, use pg_dump with specific table flags:
-- 
-- pg_dump -h <host> -U postgres -d postgres \
--   --data-only --table=public.accounts --table=public.contacts \
--   --table=public.opportunities --table=public.proposals \
--   --table=public.activities --table=public.stages \
--   --table=public.products > data_large_tables.sql
--
-- Or use Supabase Dashboard > SQL Editor to run:
-- COPY accounts TO '/tmp/accounts.csv' WITH CSV HEADER;
-- ============================================================

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Refresh materialized views if any
-- REFRESH MATERIALIZED VIEW CONCURRENTLY ...;

-- DONE
SELECT 'Data import completed!' as status;
