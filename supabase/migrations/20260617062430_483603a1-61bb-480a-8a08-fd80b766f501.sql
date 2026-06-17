GRANT SELECT, INSERT, UPDATE ON public.bonus_results TO authenticated;
GRANT ALL ON public.bonus_results TO service_role;

DROP POLICY IF EXISTS bonus_res_admin_update ON public.bonus_results;
CREATE POLICY bonus_res_admin_update ON public.bonus_results
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS bonus_res_admin_insert ON public.bonus_results;
CREATE POLICY bonus_res_admin_insert ON public.bonus_results
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
