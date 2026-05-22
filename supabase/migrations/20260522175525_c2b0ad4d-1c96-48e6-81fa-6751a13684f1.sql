
-- Lock down server-only-write tables: keep SELECT open for anon (client reads),
-- remove all write access (service_role bypasses RLS anyway).

-- matches
DROP POLICY IF EXISTS matches_anon_write ON public.matches;
-- SELECT policy matches_anon_select stays.

-- match_stats
DROP POLICY IF EXISTS match_stats_anon_all ON public.match_stats;
CREATE POLICY match_stats_anon_select ON public.match_stats
  FOR SELECT TO anon, authenticated USING (true);

-- sync_log
DROP POLICY IF EXISTS sync_log_anon_all ON public.sync_log;
CREATE POLICY sync_log_anon_select ON public.sync_log
  FOR SELECT TO anon, authenticated USING (true);

-- bonus_results
DROP POLICY IF EXISTS bonus_res_anon_all ON public.bonus_results;
CREATE POLICY bonus_res_anon_select ON public.bonus_results
  FOR SELECT TO anon, authenticated USING (true);

-- bonus_tournament_stats
DROP POLICY IF EXISTS bonus_tstats_anon_all ON public.bonus_tournament_stats;
CREATE POLICY bonus_tstats_anon_select ON public.bonus_tournament_stats
  FOR SELECT TO anon, authenticated USING (true);

-- bonus_points
DROP POLICY IF EXISTS bonus_points_anon_all ON public.bonus_points;
CREATE POLICY bonus_points_anon_select ON public.bonus_points
  FOR SELECT TO anon, authenticated USING (true);

-- Fix mutable search_path on internal email queue helpers
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
