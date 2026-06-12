CREATE OR REPLACE FUNCTION public.predictions_deadline_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m RECORD;
  user_locked boolean;
BEGIN
  SELECT is_locked INTO user_locked FROM public.profiles WHERE id = NEW.user_id;
  IF COALESCE(user_locked, false) THEN
    RAISE EXCEPTION 'Je account is vergrendeld door een beheerder — voorspellingen kunnen niet meer worden aangepast.';
  END IF;
  SELECT match_date, is_locked INTO m FROM public.matches WHERE id = NEW.match_id;
  IF m IS NULL THEN
    RAISE EXCEPTION 'Onbekende wedstrijd';
  END IF;
  IF m.is_locked THEN
    RAISE EXCEPTION 'Deadline verstreken — voorspelling kan niet meer worden aangepast.';
  END IF;
  IF (m.match_date - INTERVAL '30 minutes') <= now() THEN
    RAISE EXCEPTION 'Deadline verstreken — voorspellingen sluiten 30 minuten vóór de aftrap van deze wedstrijd.';
  END IF;
  RETURN NEW;
END $function$;