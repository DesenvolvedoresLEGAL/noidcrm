
CREATE TABLE public.cnpj_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  provider TEXT NOT NULL DEFAULT 'unknown',
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  last_error TEXT,
  last_error_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_cnpj_cache_cnpj ON public.cnpj_cache (cnpj);
CREATE INDEX idx_cnpj_cache_expires ON public.cnpj_cache (expires_at);

ALTER TABLE public.cnpj_cache ENABLE ROW LEVEL SECURITY;

-- Service role (edge functions) can do everything
CREATE POLICY "Service role full access on cnpj_cache"
ON public.cnpj_cache
FOR ALL
USING (true)
WITH CHECK (true);
