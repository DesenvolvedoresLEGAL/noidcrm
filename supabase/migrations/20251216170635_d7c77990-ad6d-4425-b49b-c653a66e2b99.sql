-- =============================================
-- REVENUE KNOWLEDGE GRAPH - Complete Schema
-- =============================================

-- 1. ENUMS para tipos de nós e arestas
CREATE TYPE graph_node_type AS ENUM (
  'account', 'contact', 'opportunity', 'interaction', 
  'proposal', 'contract', 'user'
);

CREATE TYPE graph_edge_type AS ENUM (
  'works_at',           -- Contact → Account
  'owns',               -- User → Opportunity/Account
  'relates_to',         -- Opportunity → Account, Proposal → Opportunity
  'influences',         -- Contact → Opportunity (decision makers)
  'communicates_with',  -- User ↔ Contact (via interactions)
  'champions',          -- Contact → Opportunity (champion identificado)
  'blocks',             -- Contact → Opportunity (blocker identificado)
  'participates_in',    -- User → Opportunity (deal team)
  'converts_to'         -- Proposal → Contract
);

CREATE TYPE graph_insight_type AS ENUM (
  'missing_champion',        -- Deal sem champion identificado
  'missing_decision_maker',  -- Deal sem decisor
  'silent_stakeholder',      -- Contato sem interação recente
  'isolated_deal',           -- Deal com poucas conexões
  'weak_relationship',       -- Relação com score baixo
  'network_gap',             -- Falta de conexões esperadas
  'high_centrality',         -- Nó muito importante
  'engagement_decay'         -- Relacionamento esfriando
);

-- 2. Tabela graph_builds (Histórico de Construção)
CREATE TABLE graph_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  status TEXT NOT NULL DEFAULT 'pending',
  build_type TEXT NOT NULL DEFAULT 'full',
  
  nodes_created INTEGER DEFAULT 0,
  nodes_updated INTEGER DEFAULT 0,
  edges_created INTEGER DEFAULT 0,
  edges_updated INTEGER DEFAULT 0,
  insights_generated INTEGER DEFAULT 0,
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  error_message TEXT,
  error_details JSONB,
  
  triggered_by TEXT DEFAULT 'cron',
  entity_type TEXT,
  entity_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela graph_nodes (Nós do Grafo)
CREATE TABLE graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  node_type graph_node_type NOT NULL,
  entity_id UUID NOT NULL,
  
  label TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  
  centrality_score NUMERIC(5,4) DEFAULT 0,
  connectivity_score INTEGER DEFAULT 0,
  activity_score NUMERIC(5,2) DEFAULT 0,
  
  last_build_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, node_type, entity_id)
);

-- 4. Tabela graph_edges (Arestas do Grafo)
CREATE TABLE graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  source_node_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  
  edge_type graph_edge_type NOT NULL,
  is_bidirectional BOOLEAN DEFAULT false,
  
  weight NUMERIC(5,4) DEFAULT 1.0,
  strength TEXT DEFAULT 'medium',
  
  recency_score NUMERIC(5,4) DEFAULT 0,
  frequency_score NUMERIC(5,4) DEFAULT 0,
  sentiment_score NUMERIC(5,4) DEFAULT 0.5,
  
  properties JSONB DEFAULT '{}',
  interaction_count INTEGER DEFAULT 0,
  last_interaction_at TIMESTAMPTZ,
  
  last_build_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, source_node_id, target_node_id, edge_type)
);

-- 5. Tabela graph_insights (Insights Derivados)
CREATE TABLE graph_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  
  insight_type graph_insight_type NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  suggested_action TEXT,
  action_type TEXT,
  
  related_nodes JSONB DEFAULT '[]',
  related_edges JSONB DEFAULT '[]',
  evidence JSONB DEFAULT '{}',
  
  status TEXT DEFAULT 'active',
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  
  build_id UUID REFERENCES graph_builds(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Índices para performance
CREATE INDEX idx_graph_nodes_org ON graph_nodes(organization_id);
CREATE INDEX idx_graph_nodes_type ON graph_nodes(node_type);
CREATE INDEX idx_graph_nodes_entity ON graph_nodes(entity_id);
CREATE INDEX idx_graph_nodes_org_type ON graph_nodes(organization_id, node_type);

CREATE INDEX idx_graph_edges_org ON graph_edges(organization_id);
CREATE INDEX idx_graph_edges_source ON graph_edges(source_node_id);
CREATE INDEX idx_graph_edges_target ON graph_edges(target_node_id);
CREATE INDEX idx_graph_edges_type ON graph_edges(edge_type);
CREATE INDEX idx_graph_edges_weight ON graph_edges(weight DESC);

CREATE INDEX idx_graph_insights_org ON graph_insights(organization_id);
CREATE INDEX idx_graph_insights_entity ON graph_insights(entity_type, entity_id);
CREATE INDEX idx_graph_insights_status ON graph_insights(status);
CREATE INDEX idx_graph_insights_type ON graph_insights(insight_type);

CREATE INDEX idx_graph_builds_org ON graph_builds(organization_id);
CREATE INDEX idx_graph_builds_status ON graph_builds(status);

-- 7. RLS Policies
ALTER TABLE graph_builds ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_insights ENABLE ROW LEVEL SECURITY;

-- graph_builds policies
CREATE POLICY "Users can view org graph builds"
  ON graph_builds FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "System can insert graph builds"
  ON graph_builds FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "System can update graph builds"
  ON graph_builds FOR UPDATE
  USING (organization_id = get_user_organization_id());

-- graph_nodes policies
CREATE POLICY "Users can view org graph nodes"
  ON graph_nodes FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "System can manage graph nodes"
  ON graph_nodes FOR ALL
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- graph_edges policies
CREATE POLICY "Users can view org graph edges"
  ON graph_edges FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "System can manage graph edges"
  ON graph_edges FOR ALL
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- graph_insights policies
CREATE POLICY "Users can view org graph insights"
  ON graph_insights FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org graph insights"
  ON graph_insights FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "System can insert graph insights"
  ON graph_insights FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- 8. Função para calcular peso das arestas
CREATE OR REPLACE FUNCTION calculate_edge_weight(p_edge_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_edge RECORD;
  v_recency NUMERIC;
  v_frequency NUMERIC;
  v_sentiment NUMERIC;
  v_weight NUMERIC;
BEGIN
  SELECT * INTO v_edge FROM graph_edges WHERE id = p_edge_id;
  
  IF v_edge IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Recency: decai com o tempo (50% após 30 dias)
  v_recency := CASE 
    WHEN v_edge.last_interaction_at IS NULL THEN 0.3
    ELSE GREATEST(0.1, EXP(-0.023 * EXTRACT(DAY FROM (NOW() - v_edge.last_interaction_at))))
  END;
  
  -- Frequency: normalizado por log
  v_frequency := CASE 
    WHEN v_edge.interaction_count = 0 THEN 0.2
    ELSE LEAST(1.0, LN(v_edge.interaction_count + 1) / LN(20))
  END;
  
  -- Sentiment: já normalizado 0-1
  v_sentiment := COALESCE(v_edge.sentiment_score, 0.5);
  
  -- Peso final: média ponderada
  v_weight := (v_recency * 0.4) + (v_frequency * 0.35) + (v_sentiment * 0.25);
  
  -- Atualizar edge
  UPDATE graph_edges SET 
    recency_score = v_recency,
    frequency_score = v_frequency,
    weight = v_weight,
    strength = CASE 
      WHEN v_weight >= 0.7 THEN 'strong'
      WHEN v_weight >= 0.4 THEN 'medium'
      ELSE 'weak'
    END,
    updated_at = NOW()
  WHERE id = p_edge_id;
  
  RETURN v_weight;
END;
$$;

-- 9. Função principal de build do grafo
CREATE OR REPLACE FUNCTION build_knowledge_graph(
  p_organization_id UUID,
  p_build_type TEXT DEFAULT 'full'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_build_id UUID;
  v_nodes_created INTEGER := 0;
  v_nodes_updated INTEGER := 0;
  v_edges_created INTEGER := 0;
  v_edges_updated INTEGER := 0;
  v_temp_count INTEGER;
BEGIN
  -- Criar registro do build
  INSERT INTO graph_builds (organization_id, build_type, status, started_at)
  VALUES (p_organization_id, p_build_type, 'running', NOW())
  RETURNING id INTO v_build_id;
  
  BEGIN
    -- ====================================
    -- FASE 1: CRIAR/ATUALIZAR NÓS
    -- ====================================
    
    -- 1.1 Nós para Accounts
    WITH upserted AS (
      INSERT INTO graph_nodes (organization_id, node_type, entity_id, label, properties)
      SELECT 
        a.organization_id, 
        'account'::graph_node_type, 
        a.id,
        COALESCE(a.nome_fantasia, a.razao_social),
        jsonb_build_object(
          'cnpj', a.cnpj,
          'lead_score', a.lead_score,
          'lead_grade', a.lead_grade,
          'lifecycle_stage', a.lifecycle_stage,
          'segmento', a.segmento
        )
      FROM accounts a 
      WHERE a.organization_id = p_organization_id
      ON CONFLICT (organization_id, node_type, entity_id) 
      DO UPDATE SET 
        label = EXCLUDED.label, 
        properties = EXCLUDED.properties, 
        last_build_at = NOW(),
        updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    )
    SELECT 
      COUNT(*) FILTER (WHERE inserted) AS created,
      COUNT(*) FILTER (WHERE NOT inserted) AS updated
    INTO v_temp_count, v_nodes_updated
    FROM upserted;
    v_nodes_created := v_nodes_created + v_temp_count;
    
    -- 1.2 Nós para Contacts
    WITH upserted AS (
      INSERT INTO graph_nodes (organization_id, node_type, entity_id, label, properties)
      SELECT 
        c.organization_id, 
        'contact'::graph_node_type, 
        c.id,
        c.nome,
        jsonb_build_object(
          'cargo', c.cargo,
          'emails', c.emails,
          'telefones', c.telefones,
          'account_id', c.account_id
        )
      FROM contacts c 
      WHERE c.organization_id = p_organization_id
      ON CONFLICT (organization_id, node_type, entity_id) 
      DO UPDATE SET 
        label = EXCLUDED.label, 
        properties = EXCLUDED.properties, 
        last_build_at = NOW(),
        updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    )
    SELECT COUNT(*) FILTER (WHERE inserted) INTO v_temp_count FROM upserted;
    v_nodes_created := v_nodes_created + v_temp_count;
    
    -- 1.3 Nós para Opportunities
    WITH upserted AS (
      INSERT INTO graph_nodes (organization_id, node_type, entity_id, label, properties)
      SELECT 
        o.organization_id, 
        'opportunity'::graph_node_type, 
        o.id,
        o.title,
        jsonb_build_object(
          'value', o.valor_previsto,
          'status', o.status,
          'temperature', o.temperature,
          'stage_id', o.stage_id,
          'pipeline_id', o.pipeline_id,
          'account_id', o.account_id,
          'owner_user_id', o.owner_user_id
        )
      FROM opportunities o 
      WHERE o.organization_id = p_organization_id
      ON CONFLICT (organization_id, node_type, entity_id) 
      DO UPDATE SET 
        label = EXCLUDED.label, 
        properties = EXCLUDED.properties, 
        last_build_at = NOW(),
        updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    )
    SELECT COUNT(*) FILTER (WHERE inserted) INTO v_temp_count FROM upserted;
    v_nodes_created := v_nodes_created + v_temp_count;
    
    -- 1.4 Nós para Proposals
    WITH upserted AS (
      INSERT INTO graph_nodes (organization_id, node_type, entity_id, label, properties)
      SELECT 
        p.organization_id, 
        'proposal'::graph_node_type, 
        p.id,
        COALESCE(p.title, 'Proposta ' || p.proposal_number),
        jsonb_build_object(
          'status', p.status,
          'value', p.total_amount,
          'opportunity_id', p.opportunity_id,
          'views_count', p.views_count
        )
      FROM proposals p 
      WHERE p.organization_id = p_organization_id
      ON CONFLICT (organization_id, node_type, entity_id) 
      DO UPDATE SET 
        label = EXCLUDED.label, 
        properties = EXCLUDED.properties, 
        last_build_at = NOW(),
        updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    )
    SELECT COUNT(*) FILTER (WHERE inserted) INTO v_temp_count FROM upserted;
    v_nodes_created := v_nodes_created + v_temp_count;
    
    -- 1.5 Nós para Users (profiles)
    WITH upserted AS (
      INSERT INTO graph_nodes (organization_id, node_type, entity_id, label, properties)
      SELECT 
        pr.organization_id, 
        'user'::graph_node_type, 
        pr.user_id,
        pr.full_name,
        jsonb_build_object(
          'email', pr.email,
          'role', om.org_role,
          'avatar_url', pr.avatar_url
        )
      FROM profiles pr
      JOIN organization_members om ON om.user_id = pr.user_id AND om.organization_id = pr.organization_id
      WHERE pr.organization_id = p_organization_id AND om.status = 'active'
      ON CONFLICT (organization_id, node_type, entity_id) 
      DO UPDATE SET 
        label = EXCLUDED.label, 
        properties = EXCLUDED.properties, 
        last_build_at = NOW(),
        updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    )
    SELECT COUNT(*) FILTER (WHERE inserted) INTO v_temp_count FROM upserted;
    v_nodes_created := v_nodes_created + v_temp_count;
    
    -- ====================================
    -- FASE 2: CRIAR/ATUALIZAR ARESTAS
    -- ====================================
    
    -- 2.1 Arestas works_at (Contact → Account)
    WITH upserted AS (
      INSERT INTO graph_edges (organization_id, source_node_id, target_node_id, edge_type, weight)
      SELECT 
        c.organization_id,
        gn_contact.id,
        gn_account.id,
        'works_at'::graph_edge_type,
        1.0
      FROM contacts c
      JOIN graph_nodes gn_contact ON gn_contact.entity_id = c.id 
        AND gn_contact.node_type = 'contact' 
        AND gn_contact.organization_id = c.organization_id
      JOIN graph_nodes gn_account ON gn_account.entity_id = c.account_id 
        AND gn_account.node_type = 'account' 
        AND gn_account.organization_id = c.organization_id
      WHERE c.organization_id = p_organization_id AND c.account_id IS NOT NULL
      ON CONFLICT (organization_id, source_node_id, target_node_id, edge_type)
      DO UPDATE SET last_build_at = NOW(), updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    )
    SELECT COUNT(*) FILTER (WHERE inserted) INTO v_temp_count FROM upserted;
    v_edges_created := v_edges_created + v_temp_count;
    
    -- 2.2 Arestas relates_to (Opportunity → Account)
    WITH upserted AS (
      INSERT INTO graph_edges (organization_id, source_node_id, target_node_id, edge_type, weight)
      SELECT 
        o.organization_id,
        gn_opp.id,
        gn_account.id,
        'relates_to'::graph_edge_type,
        1.0
      FROM opportunities o
      JOIN graph_nodes gn_opp ON gn_opp.entity_id = o.id 
        AND gn_opp.node_type = 'opportunity' 
        AND gn_opp.organization_id = o.organization_id
      JOIN graph_nodes gn_account ON gn_account.entity_id = o.account_id 
        AND gn_account.node_type = 'account' 
        AND gn_account.organization_id = o.organization_id
      WHERE o.organization_id = p_organization_id AND o.account_id IS NOT NULL
      ON CONFLICT (organization_id, source_node_id, target_node_id, edge_type)
      DO UPDATE SET last_build_at = NOW(), updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    )
    SELECT COUNT(*) FILTER (WHERE inserted) INTO v_temp_count FROM upserted;
    v_edges_created := v_edges_created + v_temp_count;
    
    -- 2.3 Arestas owns (User → Opportunity)
    WITH upserted AS (
      INSERT INTO graph_edges (organization_id, source_node_id, target_node_id, edge_type, weight)
      SELECT 
        o.organization_id,
        gn_user.id,
        gn_opp.id,
        'owns'::graph_edge_type,
        1.0
      FROM opportunities o
      JOIN graph_nodes gn_user ON gn_user.entity_id = o.owner_user_id 
        AND gn_user.node_type = 'user' 
        AND gn_user.organization_id = o.organization_id
      JOIN graph_nodes gn_opp ON gn_opp.entity_id = o.id 
        AND gn_opp.node_type = 'opportunity' 
        AND gn_opp.organization_id = o.organization_id
      WHERE o.organization_id = p_organization_id AND o.owner_user_id IS NOT NULL
      ON CONFLICT (organization_id, source_node_id, target_node_id, edge_type)
      DO UPDATE SET last_build_at = NOW(), updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    )
    SELECT COUNT(*) FILTER (WHERE inserted) INTO v_temp_count FROM upserted;
    v_edges_created := v_edges_created + v_temp_count;
    
    -- 2.4 Arestas participates_in (Deal Participants)
    WITH upserted AS (
      INSERT INTO graph_edges (organization_id, source_node_id, target_node_id, edge_type, weight, properties)
      SELECT 
        dp.organization_id,
        gn_user.id,
        gn_opp.id,
        'participates_in'::graph_edge_type,
        CASE dp.role 
          WHEN 'owner' THEN 1.0 
          WHEN 'collaborator' THEN 0.8 
          ELSE 0.5 
        END,
        jsonb_build_object('role', dp.role, 'share_percentage', dp.share_percentage)
      FROM deal_participants dp
      JOIN graph_nodes gn_user ON gn_user.entity_id = dp.user_id 
        AND gn_user.node_type = 'user' 
        AND gn_user.organization_id = dp.organization_id
      JOIN graph_nodes gn_opp ON gn_opp.entity_id = dp.opportunity_id 
        AND gn_opp.node_type = 'opportunity' 
        AND gn_opp.organization_id = dp.organization_id
      WHERE dp.organization_id = p_organization_id
      ON CONFLICT (organization_id, source_node_id, target_node_id, edge_type)
      DO UPDATE SET 
        weight = EXCLUDED.weight, 
        properties = EXCLUDED.properties,
        last_build_at = NOW(), 
        updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    )
    SELECT COUNT(*) FILTER (WHERE inserted) INTO v_temp_count FROM upserted;
    v_edges_created := v_edges_created + v_temp_count;
    
    -- 2.5 Arestas relates_to (Proposal → Opportunity)
    WITH upserted AS (
      INSERT INTO graph_edges (organization_id, source_node_id, target_node_id, edge_type, weight)
      SELECT 
        p.organization_id,
        gn_prop.id,
        gn_opp.id,
        'relates_to'::graph_edge_type,
        CASE p.status 
          WHEN 'accepted' THEN 1.0 
          WHEN 'sent' THEN 0.8 
          ELSE 0.5 
        END
      FROM proposals p
      JOIN graph_nodes gn_prop ON gn_prop.entity_id = p.id 
        AND gn_prop.node_type = 'proposal' 
        AND gn_prop.organization_id = p.organization_id
      JOIN graph_nodes gn_opp ON gn_opp.entity_id = p.opportunity_id 
        AND gn_opp.node_type = 'opportunity' 
        AND gn_opp.organization_id = p.organization_id
      WHERE p.organization_id = p_organization_id AND p.opportunity_id IS NOT NULL
      ON CONFLICT (organization_id, source_node_id, target_node_id, edge_type)
      DO UPDATE SET weight = EXCLUDED.weight, last_build_at = NOW(), updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    )
    SELECT COUNT(*) FILTER (WHERE inserted) INTO v_temp_count FROM upserted;
    v_edges_created := v_edges_created + v_temp_count;
    
    -- 2.6 Arestas communicates_with baseadas em interactions
    WITH interaction_edges AS (
      SELECT 
        i.organization_id,
        i.user_id,
        i.contact_id,
        COUNT(*) as interaction_count,
        MAX(i.created_at) as last_interaction,
        AVG(COALESCE(i.sentiment_score, 0)) as avg_sentiment
      FROM interactions i
      WHERE i.organization_id = p_organization_id 
        AND i.user_id IS NOT NULL 
        AND i.contact_id IS NOT NULL
      GROUP BY i.organization_id, i.user_id, i.contact_id
    ),
    upserted AS (
      INSERT INTO graph_edges (
        organization_id, source_node_id, target_node_id, edge_type, 
        is_bidirectional, interaction_count, last_interaction_at, sentiment_score
      )
      SELECT 
        ie.organization_id,
        gn_user.id,
        gn_contact.id,
        'communicates_with'::graph_edge_type,
        true,
        ie.interaction_count,
        ie.last_interaction,
        (ie.avg_sentiment + 1) / 2  -- normalizar de -1,1 para 0,1
      FROM interaction_edges ie
      JOIN graph_nodes gn_user ON gn_user.entity_id = ie.user_id 
        AND gn_user.node_type = 'user' 
        AND gn_user.organization_id = ie.organization_id
      JOIN graph_nodes gn_contact ON gn_contact.entity_id = ie.contact_id 
        AND gn_contact.node_type = 'contact' 
        AND gn_contact.organization_id = ie.organization_id
      ON CONFLICT (organization_id, source_node_id, target_node_id, edge_type)
      DO UPDATE SET 
        interaction_count = EXCLUDED.interaction_count,
        last_interaction_at = EXCLUDED.last_interaction_at,
        sentiment_score = EXCLUDED.sentiment_score,
        last_build_at = NOW(), 
        updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    )
    SELECT COUNT(*) FILTER (WHERE inserted) INTO v_temp_count FROM upserted;
    v_edges_created := v_edges_created + v_temp_count;
    
    -- 2.7 Arestas influences (Contact → Opportunity baseado em atividades)
    WITH contact_opp_activities AS (
      SELECT 
        a.organization_id,
        a.contact_id,
        a.opportunity_id,
        COUNT(*) as activity_count,
        MAX(COALESCE(a.completed_at, a.scheduled_date)) as last_activity
      FROM activities a
      WHERE a.organization_id = p_organization_id 
        AND a.contact_id IS NOT NULL 
        AND a.opportunity_id IS NOT NULL
      GROUP BY a.organization_id, a.contact_id, a.opportunity_id
    ),
    upserted AS (
      INSERT INTO graph_edges (
        organization_id, source_node_id, target_node_id, edge_type, 
        interaction_count, last_interaction_at
      )
      SELECT 
        coa.organization_id,
        gn_contact.id,
        gn_opp.id,
        'influences'::graph_edge_type,
        coa.activity_count,
        coa.last_activity
      FROM contact_opp_activities coa
      JOIN graph_nodes gn_contact ON gn_contact.entity_id = coa.contact_id 
        AND gn_contact.node_type = 'contact' 
        AND gn_contact.organization_id = coa.organization_id
      JOIN graph_nodes gn_opp ON gn_opp.entity_id = coa.opportunity_id 
        AND gn_opp.node_type = 'opportunity' 
        AND gn_opp.organization_id = coa.organization_id
      ON CONFLICT (organization_id, source_node_id, target_node_id, edge_type)
      DO UPDATE SET 
        interaction_count = EXCLUDED.interaction_count,
        last_interaction_at = EXCLUDED.last_interaction_at,
        last_build_at = NOW(), 
        updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    )
    SELECT COUNT(*) FILTER (WHERE inserted) INTO v_temp_count FROM upserted;
    v_edges_created := v_edges_created + v_temp_count;
    
    -- 2.8 Arestas champions (baseado em win_loss_records)
    WITH upserted AS (
      INSERT INTO graph_edges (organization_id, source_node_id, target_node_id, edge_type, weight)
      SELECT 
        wlr.organization_id,
        gn_contact.id,
        gn_opp.id,
        'champions'::graph_edge_type,
        1.0
      FROM win_loss_records wlr
      JOIN graph_nodes gn_contact ON gn_contact.entity_id = wlr.champion_contact_id 
        AND gn_contact.node_type = 'contact' 
        AND gn_contact.organization_id = wlr.organization_id
      JOIN graph_nodes gn_opp ON gn_opp.entity_id = wlr.opportunity_id 
        AND gn_opp.node_type = 'opportunity' 
        AND gn_opp.organization_id = wlr.organization_id
      WHERE wlr.organization_id = p_organization_id AND wlr.champion_contact_id IS NOT NULL
      ON CONFLICT (organization_id, source_node_id, target_node_id, edge_type)
      DO UPDATE SET last_build_at = NOW(), updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    )
    SELECT COUNT(*) FILTER (WHERE inserted) INTO v_temp_count FROM upserted;
    v_edges_created := v_edges_created + v_temp_count;
    
    -- ====================================
    -- FASE 3: CALCULAR PESOS DAS ARESTAS
    -- ====================================
    PERFORM calculate_edge_weight(id) 
    FROM graph_edges 
    WHERE organization_id = p_organization_id
      AND edge_type IN ('communicates_with', 'influences');
    
    -- ====================================
    -- FASE 4: CALCULAR MÉTRICAS DOS NÓS
    -- ====================================
    
    -- Atualizar connectivity_score (número de conexões)
    UPDATE graph_nodes gn SET
      connectivity_score = (
        SELECT COUNT(DISTINCT e.id)
        FROM graph_edges e
        WHERE e.source_node_id = gn.id OR e.target_node_id = gn.id
      ),
      updated_at = NOW()
    WHERE gn.organization_id = p_organization_id;
    
    -- Atualizar activity_score baseado em recência
    UPDATE graph_nodes gn SET
      activity_score = COALESCE((
        SELECT AVG(e.recency_score) * 100
        FROM graph_edges e
        WHERE (e.source_node_id = gn.id OR e.target_node_id = gn.id)
          AND e.recency_score > 0
      ), 0),
      updated_at = NOW()
    WHERE gn.organization_id = p_organization_id;
    
    -- ====================================
    -- FASE 5: FINALIZAR BUILD
    -- ====================================
    UPDATE graph_builds SET 
      status = 'completed',
      completed_at = NOW(),
      nodes_created = v_nodes_created,
      nodes_updated = v_nodes_updated,
      edges_created = v_edges_created,
      edges_updated = v_edges_updated,
      duration_ms = EXTRACT(MILLISECONDS FROM (NOW() - started_at))::INTEGER
    WHERE id = v_build_id;
    
  EXCEPTION WHEN OTHERS THEN
    UPDATE graph_builds SET 
      status = 'failed',
      completed_at = NOW(),
      error_message = SQLERRM,
      error_details = jsonb_build_object('sqlstate', SQLSTATE)
    WHERE id = v_build_id;
    RAISE;
  END;
  
  RETURN v_build_id;
END;
$$;

-- 10. Função para gerar insights do grafo
CREATE OR REPLACE FUNCTION generate_graph_insights(
  p_organization_id UUID,
  p_build_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_insights_count INTEGER := 0;
  v_temp_count INTEGER;
BEGIN
  -- Limpar insights antigos resolvidos ou expirados
  DELETE FROM graph_insights 
  WHERE organization_id = p_organization_id 
    AND (status = 'resolved' OR created_at < NOW() - INTERVAL '30 days');
  
  -- ====================================
  -- INSIGHT 1: Missing Champion (deals > R$50k sem champion)
  -- ====================================
  WITH missing_champions AS (
    SELECT 
      gn.entity_id as opportunity_id,
      gn.label as opp_title,
      (gn.properties->>'value')::numeric as opp_value
    FROM graph_nodes gn
    WHERE gn.organization_id = p_organization_id
      AND gn.node_type = 'opportunity'
      AND (gn.properties->>'status') = 'open'
      AND (gn.properties->>'value')::numeric >= 50000
      AND NOT EXISTS (
        SELECT 1 FROM graph_edges ge
        WHERE ge.target_node_id = gn.id
          AND ge.edge_type = 'champions'
      )
  )
  INSERT INTO graph_insights (
    organization_id, entity_type, entity_id, insight_type, severity,
    title, description, suggested_action, action_type, evidence, build_id
  )
  SELECT 
    p_organization_id,
    'opportunity',
    mc.opportunity_id,
    'missing_champion'::graph_insight_type,
    'high',
    'Champion não identificado',
    'Esta oportunidade de R$ ' || TO_CHAR(mc.opp_value, 'FM999G999G999') || ' não possui um champion identificado. Deals sem champion têm 50% menos chance de fechamento.',
    'Identificar e registrar o contato que defende internamente sua solução',
    'update_win_loss',
    jsonb_build_object('value', mc.opp_value, 'title', mc.opp_title),
    p_build_id
  FROM missing_champions mc
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_insights_count := v_insights_count + v_temp_count;
  
  -- ====================================
  -- INSIGHT 2: Silent Stakeholder (contatos sem interação > 14 dias)
  -- ====================================
  WITH silent_stakeholders AS (
    SELECT 
      gn_contact.entity_id as contact_id,
      gn_contact.label as contact_name,
      gn_opp.entity_id as opportunity_id,
      gn_opp.label as opp_title,
      ge.last_interaction_at,
      EXTRACT(DAY FROM (NOW() - ge.last_interaction_at)) as days_silent
    FROM graph_edges ge
    JOIN graph_nodes gn_contact ON ge.source_node_id = gn_contact.id AND gn_contact.node_type = 'contact'
    JOIN graph_nodes gn_opp ON ge.target_node_id = gn_opp.id AND gn_opp.node_type = 'opportunity'
    WHERE ge.organization_id = p_organization_id
      AND ge.edge_type = 'influences'
      AND (gn_opp.properties->>'status') = 'open'
      AND ge.last_interaction_at < NOW() - INTERVAL '14 days'
  )
  INSERT INTO graph_insights (
    organization_id, entity_type, entity_id, insight_type, severity,
    title, description, suggested_action, action_type, evidence, build_id
  )
  SELECT 
    p_organization_id,
    'contact',
    ss.contact_id,
    'silent_stakeholder'::graph_insight_type,
    CASE WHEN ss.days_silent > 30 THEN 'high' ELSE 'medium' END,
    'Stakeholder sem contato recente',
    ss.contact_name || ' não é contatado há ' || ss.days_silent::INTEGER || ' dias na oportunidade "' || ss.opp_title || '".',
    'Agendar follow-up com este contato',
    'create_activity',
    jsonb_build_object(
      'contact_name', ss.contact_name, 
      'opportunity_id', ss.opportunity_id,
      'days_silent', ss.days_silent
    ),
    p_build_id
  FROM silent_stakeholders ss
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_insights_count := v_insights_count + v_temp_count;
  
  -- ====================================
  -- INSIGHT 3: Isolated Deal (< 3 conexões)
  -- ====================================
  WITH isolated_deals AS (
    SELECT 
      gn.entity_id as opportunity_id,
      gn.label as opp_title,
      gn.connectivity_score
    FROM graph_nodes gn
    WHERE gn.organization_id = p_organization_id
      AND gn.node_type = 'opportunity'
      AND (gn.properties->>'status') = 'open'
      AND gn.connectivity_score < 3
  )
  INSERT INTO graph_insights (
    organization_id, entity_type, entity_id, insight_type, severity,
    title, description, suggested_action, action_type, evidence, build_id
  )
  SELECT 
    p_organization_id,
    'opportunity',
    id.opportunity_id,
    'isolated_deal'::graph_insight_type,
    'medium',
    'Deal com rede fraca',
    'Esta oportunidade possui apenas ' || id.connectivity_score || ' conexões. Deals com rede forte têm 3x mais chance de fechamento.',
    'Adicionar mais contatos e registrar atividades',
    'add_contact',
    jsonb_build_object('title', id.opp_title, 'connections', id.connectivity_score),
    p_build_id
  FROM isolated_deals id
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_insights_count := v_insights_count + v_temp_count;
  
  -- ====================================
  -- INSIGHT 4: Weak Relationship (weight < 0.3)
  -- ====================================
  WITH weak_relationships AS (
    SELECT 
      ge.id as edge_id,
      gn_source.entity_id as source_entity_id,
      gn_source.label as source_label,
      gn_source.node_type as source_type,
      gn_target.entity_id as target_entity_id,
      gn_target.label as target_label,
      gn_target.node_type as target_type,
      ge.weight
    FROM graph_edges ge
    JOIN graph_nodes gn_source ON ge.source_node_id = gn_source.id
    JOIN graph_nodes gn_target ON ge.target_node_id = gn_target.id
    WHERE ge.organization_id = p_organization_id
      AND ge.edge_type IN ('communicates_with', 'influences')
      AND ge.weight < 0.3
      AND (gn_target.properties->>'status' IS NULL OR gn_target.properties->>'status' = 'open')
  )
  INSERT INTO graph_insights (
    organization_id, entity_type, entity_id, insight_type, severity,
    title, description, suggested_action, action_type, evidence, build_id
  )
  SELECT DISTINCT ON (wr.source_entity_id, wr.target_entity_id)
    p_organization_id,
    wr.target_type::TEXT,
    wr.target_entity_id,
    'weak_relationship'::graph_insight_type,
    'low',
    'Relacionamento enfraquecendo',
    'O relacionamento entre ' || wr.source_label || ' e ' || wr.target_label || ' está fraco (score: ' || ROUND(wr.weight * 100)::TEXT || '%).',
    'Intensificar contato para fortalecer relacionamento',
    'create_activity',
    jsonb_build_object(
      'source_label', wr.source_label,
      'target_label', wr.target_label,
      'weight', wr.weight
    ),
    p_build_id
  FROM weak_relationships wr
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_insights_count := v_insights_count + v_temp_count;
  
  -- ====================================
  -- INSIGHT 5: Engagement Decay (nenhuma atividade há 7+ dias em deal hot)
  -- ====================================
  WITH decaying_deals AS (
    SELECT 
      gn.entity_id as opportunity_id,
      gn.label as opp_title,
      gn.properties->>'temperature' as temperature,
      EXTRACT(DAY FROM (NOW() - (
        SELECT MAX(COALESCE(a.completed_at, a.scheduled_date))
        FROM activities a WHERE a.opportunity_id = gn.entity_id
      ))) as days_inactive
    FROM graph_nodes gn
    WHERE gn.organization_id = p_organization_id
      AND gn.node_type = 'opportunity'
      AND (gn.properties->>'status') = 'open'
      AND (gn.properties->>'temperature') IN ('hot', 'burning')
  )
  INSERT INTO graph_insights (
    organization_id, entity_type, entity_id, insight_type, severity,
    title, description, suggested_action, action_type, evidence, build_id
  )
  SELECT 
    p_organization_id,
    'opportunity',
    dd.opportunity_id,
    'engagement_decay'::graph_insight_type,
    'high',
    'Engajamento em queda',
    'Deal ' || dd.temperature || ' "' || dd.opp_title || '" sem atividade há ' || COALESCE(dd.days_inactive, 0)::INTEGER || ' dias. Risco de esfriar.',
    'Agendar follow-up urgente',
    'create_activity',
    jsonb_build_object('title', dd.opp_title, 'temperature', dd.temperature, 'days_inactive', dd.days_inactive),
    p_build_id
  FROM decaying_deals dd
  WHERE dd.days_inactive >= 7 OR dd.days_inactive IS NULL
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_insights_count := v_insights_count + v_temp_count;
  
  -- Atualizar contagem de insights no build
  IF p_build_id IS NOT NULL THEN
    UPDATE graph_builds SET insights_generated = v_insights_count WHERE id = p_build_id;
  END IF;
  
  RETURN v_insights_count;
END;
$$;

-- 11. Trigger para build incremental quando entidades mudam
CREATE OR REPLACE FUNCTION trigger_incremental_graph_build()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Marcar que precisa rebuild (não executar imediatamente para evitar overhead)
  -- O CRON job fará o rebuild completo
  -- Aqui apenas logamos a necessidade
  INSERT INTO graph_builds (
    organization_id, 
    build_type, 
    status, 
    triggered_by, 
    entity_type, 
    entity_id
  )
  VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    'incremental',
    'pending',
    'trigger',
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers para entidades principais (opcional - pode ser ativado via CRON apenas)
-- CREATE TRIGGER trigger_graph_on_opportunity_change
--   AFTER INSERT OR UPDATE ON opportunities
--   FOR EACH ROW EXECUTE FUNCTION trigger_incremental_graph_build();

-- 12. Função auxiliar para buscar grafo de uma entidade
CREATE OR REPLACE FUNCTION get_entity_graph(
  p_organization_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_depth INTEGER DEFAULT 2
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result JSONB;
  v_root_node_id UUID;
BEGIN
  -- Encontrar nó raiz
  SELECT id INTO v_root_node_id
  FROM graph_nodes
  WHERE organization_id = p_organization_id
    AND node_type = p_entity_type::graph_node_type
    AND entity_id = p_entity_id;
  
  IF v_root_node_id IS NULL THEN
    RETURN jsonb_build_object('nodes', '[]'::jsonb, 'edges', '[]'::jsonb);
  END IF;
  
  -- Buscar nós e arestas conectados
  WITH RECURSIVE connected_nodes AS (
    -- Nó raiz
    SELECT id, 0 as depth FROM graph_nodes WHERE id = v_root_node_id
    
    UNION
    
    -- Nós conectados
    SELECT DISTINCT 
      CASE 
        WHEN e.source_node_id = cn.id THEN e.target_node_id
        ELSE e.source_node_id
      END,
      cn.depth + 1
    FROM connected_nodes cn
    JOIN graph_edges e ON e.source_node_id = cn.id OR e.target_node_id = cn.id
    WHERE cn.depth < p_depth
      AND e.organization_id = p_organization_id
  )
  SELECT jsonb_build_object(
    'nodes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', gn.id,
        'entity_id', gn.entity_id,
        'type', gn.node_type,
        'label', gn.label,
        'properties', gn.properties,
        'connectivity', gn.connectivity_score,
        'activity', gn.activity_score
      ))
      FROM graph_nodes gn
      WHERE gn.id IN (SELECT id FROM connected_nodes)
    ), '[]'::jsonb),
    'edges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ge.id,
        'source', ge.source_node_id,
        'target', ge.target_node_id,
        'type', ge.edge_type,
        'weight', ge.weight,
        'strength', ge.strength,
        'interaction_count', ge.interaction_count,
        'last_interaction', ge.last_interaction_at
      ))
      FROM graph_edges ge
      WHERE ge.organization_id = p_organization_id
        AND (ge.source_node_id IN (SELECT id FROM connected_nodes)
          OR ge.target_node_id IN (SELECT id FROM connected_nodes))
    ), '[]'::jsonb)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;