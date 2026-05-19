-- Recreate view with security_invoker so it respects the caller's RLS
DROP VIEW IF EXISTS public.leaderboard;
CREATE VIEW public.leaderboard
WITH (security_invoker = true) AS
SELECT
  p.id AS user_id,
  p.display_name,
  p.avatar_initials,
  COALESCE((SELECT SUM(points_earned) FROM public.predictions WHERE user_id = p.id), 0)::INT AS total_match_points,
  public.user_bonus_points(p.id) AS total_bonus_points,
  (COALESCE((SELECT SUM(points_earned) FROM public.predictions WHERE user_id = p.id), 0) + public.user_bonus_points(p.id))::INT AS grand_total,
  RANK() OVER (ORDER BY (COALESCE((SELECT SUM(points_earned) FROM public.predictions WHERE user_id = p.id), 0) + public.user_bonus_points(p.id)) DESC)::INT AS rank
FROM public.profiles p;
GRANT SELECT ON public.leaderboard TO authenticated;

-- pin search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Lock down executes on admin-only functions
REVOKE EXECUTE ON FUNCTION public.calculate_match_points(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_all_points() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- is_admin and user_bonus_points are used by RLS/views — keep authenticated access
REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_bonus_points(UUID) FROM anon;