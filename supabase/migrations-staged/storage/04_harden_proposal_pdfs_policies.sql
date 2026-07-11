-- STAGED — Mesmo padrão de hardening para proposal-pdfs.

DROP POLICY IF EXISTS "Authenticated users can update proposal PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Org members can access proposal PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete proposal PDFs in their org" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload proposal PDFs in their org" ON storage.objects;
DROP POLICY IF EXISTS "Users can view proposal PDFs in their org" ON storage.objects;

CREATE POLICY "proposal_pdfs_select_own_org"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'proposal-pdfs'
  AND EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.organization_id::text = (storage.foldername(name))[1]
  )
);

-- INSERT/UPDATE/DELETE fica restrito a service_role (edge function generate-proposal-pdf).
-- Removemos as policies de authenticated para forçar caminho server-side auditado.
