CREATE OR REPLACE FUNCTION public.calculate_match_points(_match_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m RECORD; p RECORD; pts INT;
  pred_dir INT; act_dir INT; pred_diff INT; act_diff INT;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
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
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  FOR r IN SELECT id FROM public.matches WHERE actual_home_score IS NOT NULL LOOP
    PERFORM public.calculate_match_points(r.id);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.calculate_match_points(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_points() TO authenticated;