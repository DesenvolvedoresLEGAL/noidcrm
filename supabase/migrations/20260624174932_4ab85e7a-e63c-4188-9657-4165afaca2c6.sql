
-- Replace permissive SELECT policies on community tables with org-scoped policies
-- Fixes: CROSS_TENANT_DATA_EXPOSURE (community_tables_cross_tenant_read)

-- community_discussions
DROP POLICY IF EXISTS "Authenticated users can read discussions" ON public.community_discussions;
CREATE POLICY "Org members can read discussions"
  ON public.community_discussions
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id = public.get_user_organization_id()
    OR auth.uid() = user_id
  );

-- community_discussion_replies (no organization_id; scope through parent discussion)
DROP POLICY IF EXISTS "Authenticated users can read replies" ON public.community_discussion_replies;
CREATE POLICY "Org members can read replies"
  ON public.community_discussion_replies
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.community_discussions d
      WHERE d.id = community_discussion_replies.discussion_id
        AND (d.organization_id IS NULL OR d.organization_id = public.get_user_organization_id())
    )
  );

-- community_cases
DROP POLICY IF EXISTS "Authenticated users can read approved cases" ON public.community_cases;
CREATE POLICY "Org members can read approved cases"
  ON public.community_cases
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      is_approved = true
      AND (organization_id IS NULL OR organization_id = public.get_user_organization_id())
    )
  );

-- community_suggestions
DROP POLICY IF EXISTS "Authenticated users can read suggestions" ON public.community_suggestions;
CREATE POLICY "Org members can read suggestions"
  ON public.community_suggestions
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id = public.get_user_organization_id()
    OR auth.uid() = user_id
  );

-- community_suggestion_comments (scope through parent suggestion)
DROP POLICY IF EXISTS "Authenticated users can read comments" ON public.community_suggestion_comments;
CREATE POLICY "Org members can read suggestion comments"
  ON public.community_suggestion_comments
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.community_suggestions s
      WHERE s.id = community_suggestion_comments.suggestion_id
        AND (s.organization_id IS NULL OR s.organization_id = public.get_user_organization_id())
    )
  );

-- community_suggestion_votes (scope through parent suggestion)
DROP POLICY IF EXISTS "Authenticated users can read votes" ON public.community_suggestion_votes;
CREATE POLICY "Org members can read suggestion votes"
  ON public.community_suggestion_votes
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.community_suggestions s
      WHERE s.id = community_suggestion_votes.suggestion_id
        AND (s.organization_id IS NULL OR s.organization_id = public.get_user_organization_id())
    )
  );
