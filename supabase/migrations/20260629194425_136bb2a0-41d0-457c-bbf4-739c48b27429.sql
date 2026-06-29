CREATE OR REPLACE FUNCTION public.matchday_deadline(_match_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT MIN(m2.match_date) - INTERVAL '30 minutes'
  FROM public.matches m1
  JOIN public.matches m2
    ON ((m2.match_date AT TIME ZONE 'Europe/Brussels') - INTERVAL '6 hours')::date
     = ((m1.match_date AT TIME ZONE 'Europe/Brussels') - INTERVAL '6 hours')::date
  WHERE m1.id = _match_id
$function$;