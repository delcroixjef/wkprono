CREATE TABLE public.email_digest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  recipients_count integer NOT NULL DEFAULT 0,
  matches_count integer NOT NULL DEFAULT 0,
  message text,
  duration_ms integer NOT NULL DEFAULT 0
);

ALTER TABLE public.email_digest_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_digest_log_anon_all" ON public.email_digest_log
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_email_digest_log_ran_at ON public.email_digest_log (ran_at DESC);