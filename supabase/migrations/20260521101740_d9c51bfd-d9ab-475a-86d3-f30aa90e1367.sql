CREATE OR REPLACE FUNCTION public.calculate_match_points(_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m RECORD; p RECORD;
  exact_pts INT; outcome_pts INT; total INT;
  act_dir INT; pred_dir INT;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id;
  IF m.actual_home_score IS NULL OR m.actual_away_score IS NULL THEN
    UPDATE public.predictions SET points_earned = NULL, points_breakdown = '{}'::jsonb
      WHERE match_id = _match_id;
    RETURN;
  END IF;
  act_dir := sign(m.actual_home_score - m.actual_away_score);
  FOR p IN SELECT * FROM public.predictions WHERE match_id = _match_id LOOP
    exact_pts := 0; outcome_pts := 0;
    pred_dir := sign(p.predicted_home_score - p.predicted_away_score);
    IF p.predicted_home_score = m.actual_home_score
       AND p.predicted_away_score = m.actual_away_score THEN
      exact_pts := 5;
    ELSIF pred_dir = act_dir THEN
      outcome_pts := 3;
    END IF;
    total := exact_pts + outcome_pts;
    UPDATE public.predictions
      SET points_earned = total,
          points_breakdown = jsonb_build_object(
            'exact', exact_pts,
            'outcome', outcome_pts
          )
      WHERE id = p.id;
  END LOOP;
END $function$;

-- Bestaande punten herberekenen volgens nieuwe regels
SELECT public.recalculate_all_points();