
-- 1. Remove FK on profiles.id so we can insert nameless profiles (no auth.users)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Drop red-card bonus columns (no card data available)
ALTER TABLE public.bonus_predictions DROP COLUMN IF EXISTS red_card_final;
ALTER TABLE public.bonus_results DROP COLUMN IF EXISTS red_card_final;
ALTER TABLE public.bonus_tournament_stats DROP COLUMN IF EXISTS final_had_red_card;

-- 3. Recreate user_bonus_points without red_card scoring
CREATE OR REPLACE FUNCTION public.user_bonus_points(_uid uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF br.final_home_team IS NOT NULL AND br.final_home_score IS NOT NULL
     AND ((bp.final_home_team = br.final_home_team AND bp.final_away_team = br.final_away_team
           AND bp.final_home_score = br.final_home_score AND bp.final_away_score = br.final_away_score)
       OR (bp.final_home_team = br.final_away_team AND bp.final_away_team = br.final_home_team
           AND bp.final_home_score = br.final_away_score AND bp.final_away_score = br.final_home_score))
  THEN pts := pts + 15; END IF;
  RETURN pts;
END $function$;
