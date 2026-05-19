
-- 1. Add API fixture id to matches
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS api_fixture_id INTEGER UNIQUE;

-- 2. match_stats
CREATE TABLE IF NOT EXISTS public.match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  api_fixture_id INTEGER,
  home_yellow_cards INT NOT NULL DEFAULT 0,
  away_yellow_cards INT NOT NULL DEFAULT 0,
  home_red_cards INT NOT NULL DEFAULT 0,
  away_red_cards INT NOT NULL DEFAULT 0,
  home_goals_detail JSONB NOT NULL DEFAULT '[]'::jsonb,
  away_goals_detail JSONB NOT NULL DEFAULT '[]'::jsonb,
  penalties_in_match BOOLEAN NOT NULL DEFAULT false,
  went_to_extra_time BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.match_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY match_stats_anon_all ON public.match_stats
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER match_stats_touch BEFORE UPDATE ON public.match_stats
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. bonus_tournament_stats (singleton)
CREATE TABLE IF NOT EXISTS public.bonus_tournament_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  goals_by_country JSONB NOT NULL DEFAULT '{}'::jsonb,
  topscorer_countries TEXT[] NOT NULL DEFAULT '{}',
  clean_sheets_by_country JSONB NOT NULL DEFAULT '{}'::jsonb,
  clean_sheet_leader_count INT NOT NULL DEFAULT 0,
  clean_sheet_countries TEXT[] NOT NULL DEFAULT '{}',
  final_had_red_card BOOLEAN,
  top10_eliminated_in_groups TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bonus_tournament_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY bonus_tstats_anon_all ON public.bonus_tournament_stats
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
INSERT INTO public.bonus_tournament_stats (singleton) VALUES (true) ON CONFLICT DO NOTHING;

-- 4. bonus_points
CREATE TABLE IF NOT EXISTS public.bonus_points (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  points INT NOT NULL DEFAULT 0,
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bonus_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY bonus_points_anon_all ON public.bonus_points
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 5. sync_log
CREATE TABLE IF NOT EXISTS public.sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL,           -- 'ok' | 'error' | 'skipped'
  message TEXT,
  matches_updated INT NOT NULL DEFAULT 0,
  matches_locked INT NOT NULL DEFAULT 0,
  api_calls_used INT NOT NULL DEFAULT 0,
  duration_ms INT NOT NULL DEFAULT 0
);
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY sync_log_anon_all ON public.sync_log
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS sync_log_ran_at_idx ON public.sync_log (ran_at DESC);
