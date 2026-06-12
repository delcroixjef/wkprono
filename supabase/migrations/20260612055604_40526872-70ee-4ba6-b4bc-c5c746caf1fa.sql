CREATE OR REPLACE FUNCTION public.get_crowd_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  stats jsonb := '[]'::jsonb;
  played_count int;
  r record;
BEGIN
  SELECT count(*) INTO played_count FROM matches WHERE actual_home_score IS NOT NULL;

  IF played_count > 0 THEN
    -- Klassementsleider
    BEGIN
      SELECT display_name, grand_total INTO r
      FROM leaderboard ORDER BY rank ASC LIMIT 1;
      IF r.display_name IS NOT NULL AND r.grand_total > 0 THEN
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','leader',
          'text', r.display_name || ' troont bovenaan met ' || r.grand_total || ' punten. Petje af of pure beginnersgeluk?',
          'emoji','👑'
        ));
      END IF;
    END;

    -- Rode lantaarn
    BEGIN
      SELECT display_name, grand_total INTO r
      FROM leaderboard WHERE grand_total IS NOT NULL ORDER BY rank DESC LIMIT 1;
      IF r.display_name IS NOT NULL THEN
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','last',
          'text', r.display_name || ' bengelt onderaan met amper ' || r.grand_total || ' punten. Iemand een knuffel?',
          'emoji','🥶'
        ));
      END IF;
    END;

    -- Droogte: 0 punten in laatste N (>=3) gespeelde matches
    FOR r IN
      WITH played AS (
        SELECT id, match_date FROM matches WHERE actual_home_score IS NOT NULL
      ),
      ranked AS (
        SELECT p.user_id, p.points_earned,
               row_number() OVER (PARTITION BY p.user_id ORDER BY pl.match_date DESC) AS rn
        FROM predictions p
        JOIN played pl ON pl.id = p.match_id
      ),
      streaks AS (
        SELECT user_id,
               (SELECT min(rn)-1 FROM ranked r2 WHERE r2.user_id = ranked.user_id AND coalesce(r2.points_earned,0) > 0) AS zero_streak,
               max(rn) AS total
        FROM ranked GROUP BY user_id
      )
      SELECT pr.display_name,
             COALESCE(s.zero_streak, s.total) AS streak
      FROM streaks s
      JOIN profiles pr ON pr.id = s.user_id
      WHERE COALESCE(s.zero_streak, s.total) >= 3
      ORDER BY COALESCE(s.zero_streak, s.total) DESC, random()
      LIMIT 2
    LOOP
      stats := stats || jsonb_build_array(jsonb_build_object(
        'type','drought',
        'text','Het gaat precies niet goed met ' || r.display_name || ': 0 punten in de laatste ' || r.streak || ' matchen. Helpen we of lachen we hem/haar samen uit?',
        'emoji','📉'
      ));
    END LOOP;

    -- Hot streak: scoort al N matches op rij
    FOR r IN
      WITH played AS (
        SELECT id, match_date FROM matches WHERE actual_home_score IS NOT NULL
      ),
      ranked AS (
        SELECT p.user_id, p.points_earned,
               row_number() OVER (PARTITION BY p.user_id ORDER BY pl.match_date DESC) AS rn
        FROM predictions p
        JOIN played pl ON pl.id = p.match_id
      ),
      streaks AS (
        SELECT user_id,
               (SELECT min(rn)-1 FROM ranked r2 WHERE r2.user_id = ranked.user_id AND coalesce(r2.points_earned,0) = 0) AS hot_streak,
               max(rn) AS total
        FROM ranked GROUP BY user_id
      )
      SELECT pr.display_name,
             COALESCE(s.hot_streak, s.total) AS streak
      FROM streaks s
      JOIN profiles pr ON pr.id = s.user_id
      WHERE COALESCE(s.hot_streak, s.total) >= 3
      ORDER BY COALESCE(s.hot_streak, s.total) DESC, random()
      LIMIT 2
    LOOP
      stats := stats || jsonb_build_array(jsonb_build_object(
        'type','hot',
        'text', r.display_name || ' scoort al ' || r.streak || ' matchen op rij. Glazen bol of gewoon onbeschaamd geluk?',
        'emoji','🔥'
      ));
    END LOOP;

    -- Voltreffer-koning
    BEGIN
      SELECT pr.display_name, count(*) AS hits INTO r
      FROM predictions p
      JOIN matches m ON m.id = p.match_id AND m.actual_home_score IS NOT NULL
      JOIN profiles pr ON pr.id = p.user_id
      WHERE p.predicted_home_score = m.actual_home_score
        AND p.predicted_away_score = m.actual_away_score
      GROUP BY pr.display_name
      ORDER BY count(*) DESC, random() LIMIT 1;
      IF r.display_name IS NOT NULL AND r.hits >= 1 THEN
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','exact_king',
          'text', r.display_name || ' heeft al ' || r.hits || ' exacte score(s) goed. Heeft die soms een tipgever?',
          'emoji','🎯'
        ));
      END IF;
    END;

    -- Hoogste match-score
    BEGIN
      SELECT pr.display_name, p.points_earned, m.home_team, m.away_team INTO r
      FROM predictions p
      JOIN matches m ON m.id = p.match_id AND m.actual_home_score IS NOT NULL
      JOIN profiles pr ON pr.id = p.user_id
      WHERE p.points_earned IS NOT NULL
      ORDER BY p.points_earned DESC, random() LIMIT 1;
      IF r.display_name IS NOT NULL AND r.points_earned >= 5 THEN
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','match_top',
          'text', r.display_name || ' pakte ' || r.points_earned || ' punten met ' || r.home_team || ' – ' || r.away_team || '. Show-off.',
          'emoji','⭐'
        ));
      END IF;
    END;

    -- Nul-puntenclub
    BEGIN
      SELECT count(*) AS zero_count INTO r
      FROM leaderboard WHERE coalesce(grand_total,0) = 0;
      IF r.zero_count >= 1 THEN
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','zero_club',
          'text','Er zitten al ' || r.zero_count || ' deelnemer(s) in de 0-puntenclub. Volhouden, het kan alleen maar beter.',
          'emoji','🫠'
        ));
      END IF;
    END;

    -- Voorspellingsmachine
    BEGIN
      SELECT pr.display_name, count(*) AS cnt INTO r
      FROM predictions p JOIN profiles pr ON pr.id = p.user_id
      GROUP BY pr.display_name ORDER BY count(*) DESC, random() LIMIT 1;
      IF r.display_name IS NOT NULL THEN
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','machine',
          'text', r.display_name || ' heeft al ' || r.cnt || ' voorspellingen ingetikt. Iemand moet die telefoon afpakken.',
          'emoji','📱'
        ));
      END IF;
    END;
  END IF;

  -- Crowd-level fallbacks
  DECLARE total_preds int; BEGIN
    SELECT count(*) INTO total_preds FROM predictions;
    IF total_preds > 0 THEN
      stats := stats || jsonb_build_array(jsonb_build_object(
        'type','total_preds',
        'text','De groep heeft samen al ' || total_preds || ' voorspellingen ingetikt. Productief volkje.',
        'emoji','📊'
      ));
    END IF;
  END;

  DECLARE avg_goals numeric; BEGIN
    SELECT round(avg(predicted_home_score + predicted_away_score)::numeric, 1) INTO avg_goals FROM predictions;
    IF avg_goals IS NOT NULL THEN
      stats := stats || jsonb_build_array(jsonb_build_object(
        'type','avg_goals',
        'text','Gemiddeld voorspelt de bende ' || avg_goals || ' goals per match. ' ||
          CASE WHEN avg_goals >= 3 THEN 'Doelpuntenfestival in aantocht.' ELSE 'Niet bepaald rock-''n-roll.' END,
        'emoji','⚽'
      ));
    END IF;
  END;

  RETURN stats;
END;
$function$;