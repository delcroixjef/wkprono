
ALTER TABLE public.bonus_results
  ADD COLUMN IF NOT EXISTS bonus_locked boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.bonus_predictions_lock_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_locked boolean;
  global_locked boolean;
BEGIN
  SELECT COALESCE(bonus_locked, false) INTO global_locked
  FROM public.bonus_results WHERE singleton = true;
  IF COALESCE(global_locked, false) THEN
    RAISE EXCEPTION 'De bonusvragen zijn definitief gesloten door de beheerder.';
  END IF;

  SELECT is_locked INTO user_locked FROM public.profiles WHERE id = NEW.user_id;
  IF COALESCE(user_locked, false) THEN
    RAISE EXCEPTION 'Je account is vergrendeld door een beheerder — bonusvoorspellingen kunnen niet meer worden aangepast.';
  END IF;
  RETURN NEW;
END $function$;
