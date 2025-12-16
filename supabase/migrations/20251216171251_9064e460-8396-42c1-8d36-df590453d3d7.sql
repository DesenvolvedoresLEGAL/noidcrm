-- Fix build_knowledge_graph function to use correct column names from interactions table
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
    
    -- 2.6 Arestas communicates_with baseadas em interactions (usando actor_user_id)
    WITH interaction_edges AS (
      SELECT 
        i.organization_id,
        i.actor_user_id as user_id,
        i.contact_id,
        COUNT(*) as interaction_count,
        MAX(i.created_at) as last_interaction,
        AVG(COALESCE(i.sentiment_score, 0)) as avg_sentiment
      FROM interactions i
      WHERE i.organization_id = p_organization_id 
        AND i.actor_user_id IS NOT NULL 
        AND i.contact_id IS NOT NULL
      GROUP BY i.organization_id, i.actor_user_id, i.contact_id
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
        (ie.avg_sentiment + 1) / 2
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
    
    -- Atualizar connectivity_score
    UPDATE graph_nodes gn SET
      connectivity_score = (
        SELECT COUNT(DISTINCT e.id)
        FROM graph_edges e
        WHERE e.source_node_id = gn.id OR e.target_node_id = gn.id
      ),
      updated_at = NOW()
    WHERE gn.organization_id = p_organization_id;
    
    -- Atualizar activity_score
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