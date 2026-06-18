CREATE OR REPLACE FUNCTION public.bonus_predictions_lock_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_locked boolean;
  global_locked boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'De eigenaar van een bonusvoorspelling kan niet gewijzigd worden.';
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.is_locked, false) THEN
    RAISE EXCEPTION 'Deze bonusvoorspelling is vergrendeld en kan niet meer worden aangepast.';
  END IF;

  SELECT COALESCE(br.bonus_locked, false)
    INTO global_locked
    FROM public.bonus_results br
   WHERE br.singleton = true;

  IF COALESCE(global_locked, false) THEN
    RAISE EXCEPTION 'De bonusvragen zijn definitief gesloten door de beheerder.';
  END IF;

  SELECT COALESCE(p.is_locked, false)
    INTO user_locked
    FROM public.profiles p
   WHERE p.id = NEW.user_id;

  IF COALESCE(user_locked, false) THEN
    RAISE EXCEPTION 'Je account is vergrendeld door een beheerder — bonusvoorspellingen kunnen niet meer worden aangepast.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bonus_predictions_lock ON public.bonus_predictions;
DROP TRIGGER IF EXISTS bonus_predictions_lock_before_write ON public.bonus_predictions;

CREATE TRIGGER bonus_predictions_lock_before_write
BEFORE INSERT OR UPDATE ON public.bonus_predictions
FOR EACH ROW
EXECUTE FUNCTION public.bonus_predictions_lock_trigger();

GRANT SELECT, INSERT, UPDATE ON public.bonus_predictions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bonus_predictions TO authenticated;
GRANT ALL ON public.bonus_predictions TO service_role;

DROP POLICY IF EXISTS bonus_pred_anon_all ON public.bonus_predictions;
DROP POLICY IF EXISTS bonus_pred_own_insert ON public.bonus_predictions;
DROP POLICY IF EXISTS bonus_pred_own_update ON public.bonus_predictions;
DROP POLICY IF EXISTS bonus_pred_select_all ON public.bonus_predictions;
DROP POLICY IF EXISTS bonus_predictions_select_own ON public.bonus_predictions;
DROP POLICY IF EXISTS bonus_predictions_insert_own_when_open ON public.bonus_predictions;
DROP POLICY IF EXISTS bonus_predictions_update_own_when_open ON public.bonus_predictions;
DROP POLICY IF EXISTS bonus_predictions_select_participants ON public.bonus_predictions;
DROP POLICY IF EXISTS bonus_predictions_insert_participant_when_open ON public.bonus_predictions;
DROP POLICY IF EXISTS bonus_predictions_update_participant_when_open ON public.bonus_predictions;

CREATE POLICY bonus_predictions_select_participants
ON public.bonus_predictions
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY bonus_predictions_insert_participant_when_open
ON public.bonus_predictions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = bonus_predictions.user_id
      AND COALESCE(p.is_locked, false) = false
  )
  AND COALESCE(bonus_predictions.is_locked, false) = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.bonus_results br
    WHERE br.singleton = true
      AND COALESCE(br.bonus_locked, false) = true
  )
);

CREATE POLICY bonus_predictions_update_participant_when_open
ON public.bonus_predictions
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = bonus_predictions.user_id
      AND COALESCE(p.is_locked, false) = false
  )
  AND COALESCE(bonus_predictions.is_locked, false) = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.bonus_results br
    WHERE br.singleton = true
      AND COALESCE(br.bonus_locked, false) = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = bonus_predictions.user_id
      AND COALESCE(p.is_locked, false) = false
  )
  AND COALESCE(bonus_predictions.is_locked, false) = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.bonus_results br
    WHERE br.singleton = true
      AND COALESCE(br.bonus_locked, false) = true
  )
);