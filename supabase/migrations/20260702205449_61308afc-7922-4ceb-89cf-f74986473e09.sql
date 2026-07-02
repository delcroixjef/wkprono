
CREATE OR REPLACE FUNCTION public.auto_lock_matches()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.matches
     SET is_locked = true
   WHERE is_locked = false
     AND (match_date - INTERVAL '30 minutes') <= now();
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-lock-matches') THEN
    PERFORM cron.schedule('auto-lock-matches', '* * * * *', $cron$ SELECT public.auto_lock_matches(); $cron$);
  END IF;
END $$;
