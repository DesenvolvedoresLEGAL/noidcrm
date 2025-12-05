-- Função para obter IDs de todos os membros do time de um gestor
CREATE OR REPLACE FUNCTION public.get_team_member_ids(_manager_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT tm.user_id),
    ARRAY[]::uuid[]
  )
  FROM teams t
  INNER JOIN team_members tm ON tm.team_id = t.id
  WHERE t.manager_id = _manager_id;
$$;

-- Função para obter IDs dos times que o usuário pertence
CREATE OR REPLACE FUNCTION public.get_user_team_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT tm.team_id),
    ARRAY[]::uuid[]
  )
  FROM team_members tm
  WHERE tm.user_id = _user_id;
$$;

-- Função para verificar se um usuário é gestor de algum time
CREATE OR REPLACE FUNCTION public.is_team_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM teams t
    WHERE t.manager_id = _user_id
  );
$$;

-- Função para verificar se um usuário pode ver dados de outro usuário (baseado em time)
CREATE OR REPLACE FUNCTION public.can_view_user_data(_viewer_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Próprio usuário sempre pode ver seus dados
    _viewer_id = _owner_id
    OR
    -- Admin/Owner pode ver tudo
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = _viewer_id
        AND status = 'active'
        AND org_role IN ('owner', 'admin')
    )
    OR
    -- Manager pode ver dados do seu time
    EXISTS (
      SELECT 1
      FROM teams t
      INNER JOIN team_members tm ON tm.team_id = t.id
      WHERE t.manager_id = _viewer_id
        AND tm.user_id = _owner_id
    )
    OR
    -- Manager role sem time específico pode ver tudo (fallback)
    (
      EXISTS (
        SELECT 1 FROM organization_members
        WHERE user_id = _viewer_id
          AND status = 'active'
          AND org_role = 'manager'
      )
      AND NOT EXISTS (
        SELECT 1 FROM teams t WHERE t.manager_id = _viewer_id
      )
    );
$$;

-- Função principal para obter filtro de visibilidade (retorna array de user_ids visíveis)
CREATE OR REPLACE FUNCTION public.get_visible_user_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_role text;
  v_is_manager boolean;
  v_team_members uuid[];
BEGIN
  -- Buscar role do usuário
  SELECT org_role INTO v_org_role
  FROM organization_members
  WHERE user_id = _user_id AND status = 'active'
  LIMIT 1;
  
  -- Admin/Owner vê tudo (retorna NULL para indicar sem filtro)
  IF v_org_role IN ('owner', 'admin') THEN
    RETURN NULL;
  END IF;
  
  -- Verificar se é gestor de time
  SELECT public.is_team_manager(_user_id) INTO v_is_manager;
  
  IF v_is_manager THEN
    -- Gestor: retorna IDs do time + próprio ID
    SELECT public.get_team_member_ids(_user_id) INTO v_team_members;
    -- Adicionar o próprio gestor ao array
    IF NOT (_user_id = ANY(v_team_members)) THEN
      v_team_members := array_append(v_team_members, _user_id);
    END IF;
    RETURN v_team_members;
  END IF;
  
  -- Manager sem time configurado vê tudo (fallback para compatibilidade)
  IF v_org_role = 'manager' THEN
    RETURN NULL;
  END IF;
  
  -- Sales/outros: vê apenas próprios dados
  RETURN ARRAY[_user_id];
END;
$$;