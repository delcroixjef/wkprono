DROP TRIGGER IF EXISTS bonus_predictions_lock_before_write ON public.bonus_predictions;

CREATE TRIGGER bonus_predictions_lock_before_write
BEFORE INSERT OR UPDATE ON public.bonus_predictions
FOR EACH ROW
EXECUTE FUNCTION public.bonus_predictions_lock_trigger();