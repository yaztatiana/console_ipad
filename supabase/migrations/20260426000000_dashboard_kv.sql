-- Key/value store for dashboard JSON, keyed by client-chosen sync_key (treat as secret URL).
-- Anon has no direct table access; only SECURITY DEFINER RPCs.

CREATE TABLE IF NOT EXISTS public.dashboard_kv (
  k text PRIMARY KEY,
  p jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_kv ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.dashboard_kv FROM PUBLIC;
GRANT ALL ON TABLE public.dashboard_kv TO service_role;

CREATE OR REPLACE FUNCTION public.dashboard_pull(sync_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT kv.p FROM public.dashboard_kv kv WHERE kv.k = sync_key;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_push(sync_key text, payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF sync_key IS NULL OR char_length(trim(sync_key)) < 8 THEN
    RAISE EXCEPTION 'invalid sync_key';
  END IF;
  INSERT INTO public.dashboard_kv (k, p)
  VALUES (sync_key, COALESCE(payload, '{}'::jsonb))
  ON CONFLICT (k) DO UPDATE SET
    p = EXCLUDED.p,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_pull(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_push(text, jsonb) TO anon, authenticated, service_role;
