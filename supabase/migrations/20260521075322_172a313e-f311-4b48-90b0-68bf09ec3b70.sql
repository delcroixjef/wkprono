
-- Helper: deadline = 30 min vóór de vroegste match van diezelfde kalenderdag (Europe/Brussels)
CREATE OR REPLACE FUNCTION public.matchday_deadline(_match_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT MIN(m2.match_date) - INTERVAL '30 minutes'
  FROM public.matches m1
  JOIN public.matches m2
    ON (m2.match_date AT TIME ZONE 'Europe/Brussels')::date
     = (m1.match_date AT TIME ZONE 'Europe/Brussels')::date
  WHERE m1.id = _match_id
$$;

-- Trigger gebruikt nu speeldag-deadline i.p.v. per-match aftrap
CREATE OR REPLACE FUNCTION public.predictions_deadline_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m RECORD;
  deadline timestamptz;
BEGIN
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
END $$;
