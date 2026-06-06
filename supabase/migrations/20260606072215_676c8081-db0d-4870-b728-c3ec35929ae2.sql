
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.predictions_deadline_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m RECORD;
  deadline timestamptz;
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
  deadline := public.matchday_deadline(NEW.match_id);
  IF deadline IS NOT NULL AND deadline <= now() THEN
    RAISE EXCEPTION 'Deadline verstreken — voorspellingen voor deze speeldag zijn gesloten (sluiting = 30 min vóór de eerste match van de dag).';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.bonus_predictions_lock_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE user_locked boolean;
BEGIN
  SELECT is_locked INTO user_locked FROM public.profiles WHERE id = NEW.user_id;
  IF COALESCE(user_locked, false) THEN
    RAISE EXCEPTION 'Je account is vergrendeld door een beheerder — bonusvoorspellingen kunnen niet meer worden aangepast.';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS bonus_predictions_lock ON public.bonus_predictions;
CREATE TRIGGER bonus_predictions_lock
  BEFORE INSERT OR UPDATE ON public.bonus_predictions
  FOR EACH ROW EXECUTE FUNCTION public.bonus_predictions_lock_trigger();
