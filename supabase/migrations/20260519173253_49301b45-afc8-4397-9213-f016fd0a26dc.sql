-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  avatar_initials TEXT NOT NULL DEFAULT '',
  is_admin BOOLEAN NOT NULL DEFAULT false,
  profile_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin(_uid UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = _uid), false)
$$;

CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name TEXT;
  v_initials TEXT;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));
  v_initials := UPPER(LEFT(v_name, 2));
  INSERT INTO public.profiles (id, email, display_name, avatar_initials)
  VALUES (NEW.id, NEW.email, v_name, v_initials)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Matches
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_number INT NOT NULL UNIQUE,
  phase TEXT NOT NULL CHECK (phase IN ('groepsfase','ronde32','achtste','kwart','half','derde','finale')),
  group_code TEXT,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  match_date TIMESTAMPTZ NOT NULL,
  venue TEXT,
  actual_home_score INT,
  actual_away_score INT,
  is_locked BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_select_all" ON public.matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "matches_admin_write" ON public.matches FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Predictions
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  predicted_home_score INT NOT NULL CHECK (predicted_home_score BETWEEN 0 AND 20),
  predicted_away_score INT NOT NULL CHECK (predicted_away_score BETWEEN 0 AND 20),
  points_earned INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id)
);
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "predictions_select_all" ON public.predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY "predictions_own_insert" ON public.predictions FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.is_locked)
);
CREATE POLICY "predictions_own_update" ON public.predictions FOR UPDATE TO authenticated USING (
  user_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.is_locked)
);

-- Bonus predictions
CREATE TABLE public.bonus_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  topscorer_country TEXT,
  clean_sheet_country TEXT,
  early_exit_country TEXT,
  red_card_final BOOLEAN,
  final_home_team TEXT,
  final_away_team TEXT,
  final_home_score INT CHECK (final_home_score BETWEEN 0 AND 20),
  final_away_score INT CHECK (final_away_score BETWEEN 0 AND 20),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bonus_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bonus_pred_select_all" ON public.bonus_predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY "bonus_pred_own_insert" ON public.bonus_predictions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND NOT is_locked);
CREATE POLICY "bonus_pred_own_update" ON public.bonus_predictions FOR UPDATE TO authenticated USING (user_id = auth.uid() AND NOT is_locked);

-- Bonus results (single row)
CREATE TABLE public.bonus_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  topscorer_country TEXT,
  clean_sheet_countries TEXT[] DEFAULT '{}',
  early_exit_country TEXT,
  red_card_final BOOLEAN,
  final_home_team TEXT,
  final_away_team TEXT,
  final_home_score INT,
  final_away_score INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bonus_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bonus_res_select_all" ON public.bonus_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "bonus_res_admin_write" ON public.bonus_results FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.bonus_results (singleton) VALUES (true);

CREATE OR REPLACE FUNCTION public.calculate_match_points(_match_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m RECORD;
  p RECORD;
  pts INT;
  pred_dir INT;
  act_dir INT;
  pred_diff INT;
  act_diff INT;
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
END $$;

CREATE OR REPLACE FUNCTION public.recalculate_all_points()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.matches WHERE actual_home_score IS NOT NULL LOOP
    PERFORM public.calculate_match_points(r.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.user_bonus_points(_uid UUID)
RETURNS INT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  bp RECORD; br RECORD; pts INT := 0;
BEGIN
  SELECT * INTO bp FROM public.bonus_predictions WHERE user_id = _uid;
  IF bp IS NULL THEN RETURN 0; END IF;
  SELECT * INTO br FROM public.bonus_results WHERE singleton = true;
  IF br IS NULL THEN RETURN 0; END IF;
  IF br.topscorer_country IS NOT NULL AND bp.topscorer_country = br.topscorer_country THEN pts := pts + 5; END IF;
  IF br.clean_sheet_countries IS NOT NULL AND array_length(br.clean_sheet_countries,1) > 0
     AND bp.clean_sheet_country = ANY(br.clean_sheet_countries) THEN pts := pts + 5; END IF;
  IF br.early_exit_country IS NOT NULL AND bp.early_exit_country = br.early_exit_country THEN pts := pts + 8; END IF;
  IF br.red_card_final IS NOT NULL AND bp.red_card_final = br.red_card_final THEN pts := pts + 3; END IF;
  IF br.final_home_team IS NOT NULL AND br.final_home_score IS NOT NULL
     AND ((bp.final_home_team = br.final_home_team AND bp.final_away_team = br.final_away_team
           AND bp.final_home_score = br.final_home_score AND bp.final_away_score = br.final_away_score)
       OR (bp.final_home_team = br.final_away_team AND bp.final_away_team = br.final_home_team
           AND bp.final_home_score = br.final_away_score AND bp.final_away_score = br.final_home_score))
  THEN pts := pts + 15; END IF;
  RETURN pts;
END $$;

CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  p.id AS user_id,
  p.display_name,
  p.avatar_initials,
  COALESCE((SELECT SUM(points_earned) FROM public.predictions WHERE user_id = p.id), 0)::INT AS total_match_points,
  public.user_bonus_points(p.id) AS total_bonus_points,
  (COALESCE((SELECT SUM(points_earned) FROM public.predictions WHERE user_id = p.id), 0) + public.user_bonus_points(p.id))::INT AS grand_total,
  RANK() OVER (ORDER BY (COALESCE((SELECT SUM(points_earned) FROM public.predictions WHERE user_id = p.id), 0) + public.user_bonus_points(p.id)) DESC)::INT AS rank
FROM public.profiles p;

GRANT SELECT ON public.leaderboard TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER predictions_touch BEFORE UPDATE ON public.predictions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER bonus_pred_touch BEFORE UPDATE ON public.bonus_predictions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();