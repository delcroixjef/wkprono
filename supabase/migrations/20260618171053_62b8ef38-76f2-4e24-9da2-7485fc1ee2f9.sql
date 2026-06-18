DROP TRIGGER IF EXISTS bonus_predictions_lock ON public.bonus_predictions;
DROP TRIGGER IF EXISTS bonus_predictions_lock_before_write ON public.bonus_predictions;

CREATE TRIGGER bonus_predictions_lock_before_write
BEFORE INSERT OR UPDATE ON public.bonus_predictions
FOR EACH ROW
EXECUTE FUNCTION public.bonus_predictions_lock_trigger();

DROP POLICY IF EXISTS bonus_pred_anon_all ON public.bonus_predictions;
DROP POLICY IF EXISTS bonus_predictions_select_own ON public.bonus_predictions;
DROP POLICY IF EXISTS bonus_predictions_insert_own_when_open ON public.bonus_predictions;
DROP POLICY IF EXISTS bonus_predictions_update_own_when_open ON public.bonus_predictions;

CREATE POLICY bonus_predictions_select_own
ON public.bonus_predictions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY bonus_predictions_insert_own_when_open
ON public.bonus_predictions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1
    FROM public.bonus_results br
    WHERE br.singleton = true
      AND br.bonus_locked = true
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_locked = true
  )
);

CREATE POLICY bonus_predictions_update_own_when_open
ON public.bonus_predictions
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1
    FROM public.bonus_results br
    WHERE br.singleton = true
      AND br.bonus_locked = true
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_locked = true
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1
    FROM public.bonus_results br
    WHERE br.singleton = true
      AND br.bonus_locked = true
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_locked = true
  )
);