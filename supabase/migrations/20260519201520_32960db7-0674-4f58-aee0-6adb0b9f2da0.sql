
-- 1. Drop auth trigger + handler (no more Supabase sign-ups)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Profiles: detach from auth, add unique email, autogenerate id
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
-- Normalise emails to lowercase for the unique constraint
UPDATE public.profiles SET email = lower(email);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique ON public.profiles (lower(email));

-- 3. Drop all existing RLS policies that depend on auth.uid()
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;

DROP POLICY IF EXISTS predictions_own_insert ON public.predictions;
DROP POLICY IF EXISTS predictions_own_update ON public.predictions;
DROP POLICY IF EXISTS predictions_select_all ON public.predictions;

DROP POLICY IF EXISTS bonus_pred_own_insert ON public.bonus_predictions;
DROP POLICY IF EXISTS bonus_pred_own_update ON public.bonus_predictions;
DROP POLICY IF EXISTS bonus_pred_select_all ON public.bonus_predictions;

DROP POLICY IF EXISTS bonus_res_admin_write ON public.bonus_results;
DROP POLICY IF EXISTS bonus_res_select_all ON public.bonus_results;

DROP POLICY IF EXISTS matches_admin_write ON public.matches;
DROP POLICY IF EXISTS matches_select_all ON public.matches;

-- 4. New permissive policies for the anon role (no auth)
CREATE POLICY profiles_anon_all ON public.profiles
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY matches_anon_select ON public.matches
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY matches_anon_write ON public.matches
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY predictions_anon_all ON public.predictions
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY bonus_pred_anon_all ON public.bonus_predictions
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY bonus_res_anon_all ON public.bonus_results
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 5. Recalc functions: remove auth check (admin gated in UI)
CREATE OR REPLACE FUNCTION public.calculate_match_points(_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m RECORD; p RECORD; pts INT;
  pred_dir INT; act_dir INT; pred_diff INT; act_diff INT;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id;
  IF m.actual_home_score IS NULL OR m.actual_away_score IS NULL THEN
    UPDATE public.predictions SET points_earned = NULL WHERE match_id = _match_id;
    RETURN;
  END IF;
  act_dir := sign(m.actual_home_score - m.actual_away_score);
  act_diff := m.actual_home_score - m.actual_away_score;
  FOR p IN SELECT * FROM public.predictions WHERE match_id = _match_id LOOP
    pts := 0;
    IF p.predicted_home_score = m.actual_home_score AND p.predicted_away_score = m.actual_away_score THEN
      pts := 10;
    ELSE
      pred_dir := sign(p.predicted_home_score - p.predicted_away_score);
      pred_diff := p.predicted_home_score - p.predicted_away_score;
      IF pred_dir = act_dir THEN pts := pts + 5; END IF;
      IF pred_diff = act_diff THEN pts := pts + 5; END IF;
    END IF;
    UPDATE public.predictions SET points_earned = pts WHERE id = p.id;
  END LOOP;
END $function$;

CREATE OR REPLACE FUNCTION public.recalculate_all_points()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.matches WHERE actual_home_score IS NOT NULL LOOP
    PERFORM public.calculate_match_points(r.id);
  END LOOP;
END $function$;
