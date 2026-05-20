
-- 1. matches: source + override + sync tracking
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'auto'
    CHECK (source IN ('auto','manual','corrected')),
  ADD COLUMN IF NOT EXISTS auto_sync_override boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_score jsonb;

-- 2. predictions: breakdown
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS points_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3. New scoring function: 10 exact / 5 W-G-V / 5 saldo / 3 bijna-juist
CREATE OR REPLACE FUNCTION public.calculate_match_points(_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m RECORD; p RECORD;
  exact_pts INT; outcome_pts INT; diff_pts INT; near_pts INT; total INT;
  act_dir INT; pred_dir INT; act_diff INT; pred_diff INT;
  act_total INT; pred_total INT;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id;
  IF m.actual_home_score IS NULL OR m.actual_away_score IS NULL THEN
    UPDATE public.predictions SET points_earned = NULL, points_breakdown = '{}'::jsonb
      WHERE match_id = _match_id;
    RETURN;
  END IF;
  act_dir   := sign(m.actual_home_score - m.actual_away_score);
  act_diff  := m.actual_home_score - m.actual_away_score;
  act_total := m.actual_home_score + m.actual_away_score;
  FOR p IN SELECT * FROM public.predictions WHERE match_id = _match_id LOOP
    exact_pts := 0; outcome_pts := 0; diff_pts := 0; near_pts := 0;
    pred_dir   := sign(p.predicted_home_score - p.predicted_away_score);
    pred_diff  := p.predicted_home_score - p.predicted_away_score;
    pred_total := p.predicted_home_score + p.predicted_away_score;
    IF p.predicted_home_score = m.actual_home_score
       AND p.predicted_away_score = m.actual_away_score THEN
      exact_pts := 10;
    ELSE
      IF pred_dir = act_dir THEN outcome_pts := 5; END IF;
      IF pred_diff = act_diff THEN diff_pts := 5; END IF;
      -- bijna-juist: juiste W/G/V + totaal aantal doelpunten op 1 na correct
      IF pred_dir = act_dir AND abs(pred_total - act_total) <= 1
         AND NOT (pred_diff = act_diff) THEN
        near_pts := 3;
      END IF;
    END IF;
    total := exact_pts + outcome_pts + diff_pts + near_pts;
    UPDATE public.predictions
      SET points_earned = total,
          points_breakdown = jsonb_build_object(
            'exact', exact_pts,
            'outcome', outcome_pts,
            'diff', diff_pts,
            'near', near_pts
          )
      WHERE id = p.id;
  END LOOP;
END $$;

-- 4. Trigger: auto-recalc when match score changes
CREATE OR REPLACE FUNCTION public.matches_recalc_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.actual_home_score IS DISTINCT FROM OLD.actual_home_score)
     OR (NEW.actual_away_score IS DISTINCT FROM OLD.actual_away_score) THEN
    PERFORM public.calculate_match_points(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_matches_recalc ON public.matches;
CREATE TRIGGER trg_matches_recalc
  AFTER UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.matches_recalc_trigger();

-- 5. Trigger: enforce deadline on predictions (no insert/update past kickoff or lock)
CREATE OR REPLACE FUNCTION public.predictions_deadline_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m RECORD;
BEGIN
  SELECT match_date, is_locked INTO m FROM public.matches WHERE id = NEW.match_id;
  IF m IS NULL THEN
    RAISE EXCEPTION 'Onbekende wedstrijd';
  END IF;
  IF m.is_locked OR m.match_date <= now() THEN
    RAISE EXCEPTION 'Deadline verstreken — voorspelling kan niet meer worden aangepast.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_predictions_deadline ON public.predictions;
CREATE TRIGGER trg_predictions_deadline
  BEFORE INSERT OR UPDATE OF predicted_home_score, predicted_away_score
  ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.predictions_deadline_trigger();

-- 6. Enable pg_cron + pg_net (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
