-- =============================================
-- 1. Fix churn_predictions INSERT (public -> authenticated + org check)
-- =============================================
DROP POLICY IF EXISTS "churn_predictions_insert" ON public.churn_predictions;
CREATE POLICY "churn_predictions_insert" ON public.churn_predictions
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

-- =============================================
-- 2. Fix cs_health_metrics INSERT (add org check)
-- =============================================
DROP POLICY IF EXISTS "cs_health_metrics_insert" ON public.cs_health_metrics;
CREATE POLICY "cs_health_metrics_insert" ON public.cs_health_metrics
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

-- =============================================
-- 3. Fix success_plans INSERT (add org check)
-- =============================================
DROP POLICY IF EXISTS "success_plans_insert" ON public.success_plans;
CREATE POLICY "success_plans_insert" ON public.success_plans
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

-- =============================================
-- 4. Remove anon SELECT on proposals base table (PII exposure)
--    Keep the get_proposal_by_public_token() RPC as the only entry point
-- =============================================
DROP POLICY IF EXISTS "public_token_proposal_access" ON public.proposals;

-- =============================================
-- 5. Fix proposal-pdfs storage: DELETE and UPDATE need org check
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can delete proposal PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update proposal PDFs" ON storage.objects;
-- Also fix the INSERT policy which has no org check
DROP POLICY IF EXISTS "Authenticated users can upload proposal PDFs" ON storage.objects;

-- The org-scoped versions already exist for some operations, keep them.
-- Ensure UPDATE also has org check:
CREATE POLICY "Authenticated users can update proposal PDFs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'proposal-pdfs' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- =============================================
-- 6. Fix product-images storage: add org check for INSERT/UPDATE/DELETE
-- =============================================
DROP POLICY IF EXISTS "Users can upload product images in their org" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their org product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their org product images" ON storage.objects;

CREATE POLICY "Users can upload product images in their org" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can update their org product images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can delete their org product images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- =============================================
-- 7. Fix proposal-layouts storage: add org check
-- =============================================
DROP POLICY IF EXISTS "Users can upload proposal layouts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete proposal layouts" ON storage.objects;

CREATE POLICY "Users can upload proposal layouts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'proposal-layouts' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can delete proposal layouts" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'proposal-layouts' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Also fix UPDATE for proposal-layouts (currently missing explicit policy but inherited)
CREATE POLICY "Users can update proposal layouts" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'proposal-layouts' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- =============================================
-- 8. Fix organization-logos storage: add org check
-- =============================================
DROP POLICY IF EXISTS "Users can upload organization logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update organization logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete organization logos" ON storage.objects;

CREATE POLICY "Users can upload organization logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'organization-logos' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can update organization logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'organization-logos' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can delete organization logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'organization-logos' AND
    (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );