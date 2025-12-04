-- Tabela para registrar mudanças pendentes para release notes
CREATE TABLE IF NOT EXISTS public.pending_release_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'feature' CHECK (change_type IN ('feature', 'fix', 'improvement', 'security')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  release_note_id UUID REFERENCES public.release_notes(id),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- RLS
ALTER TABLE public.pending_release_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pending changes" ON public.pending_release_changes FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert pending changes" ON public.pending_release_changes FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update pending changes" ON public.pending_release_changes FOR UPDATE USING (true);

-- Index para busca de pendentes
CREATE INDEX idx_pending_release_changes_processed ON public.pending_release_changes(processed_at) WHERE processed_at IS NULL;