
CREATE OR REPLACE FUNCTION public.get_crowd_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stats jsonb := '[]'::jsonb;
  today date := (now() AT TIME ZONE 'Europe/Brussels')::date;
  total_users int;
  r record;
BEGIN
  SELECT count(*) INTO total_users FROM profiles WHERE profile_confirmed = true;

  -- Per match vandaag: outcome %, top score, split
  FOR r IN
    SELECT m.id, m.home_team, m.away_team,
      count(p.*) as total,
      count(*) FILTER (WHERE p.predicted_home_score > p.predicted_away_score) as home_w,
      count(*) FILTER (WHERE p.predicted_home_score < p.predicted_away_score) as away_w,
      count(*) FILTER (WHERE p.predicted_home_score = p.predicted_away_score) as draw_c
    FROM matches m
    LEFT JOIN predictions p ON p.match_id = m.id
    WHERE (m.match_date AT TIME ZONE 'Europe/Brussels')::date = today
      AND m.home_team <> 'TBD'
    GROUP BY m.id, m.home_team, m.away_team
  LOOP
    IF r.total >= 5 THEN
      IF r.home_w >= r.away_w AND r.home_w >= r.draw_c AND r.home_w::numeric / r.total >= 0.5 THEN
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','match_outcome',
          'text', round(r.home_w * 100.0 / r.total) || '% van de deelnemers denkt dat ' || r.home_team || ' wint van ' || r.away_team || '.',
          'emoji','🔥'
        ));
      ELSIF r.away_w >= r.home_w AND r.away_w >= r.draw_c AND r.away_w::numeric / r.total >= 0.5 THEN
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','match_outcome',
          'text', round(r.away_w * 100.0 / r.total) || '% denkt dat ' || r.away_team || ' wint van ' || r.home_team || '.',
          'emoji','🔥'
        ));
      END IF;

      IF r.draw_c::numeric / r.total <= 0.15 AND r.draw_c > 0 THEN
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','low_draw',
          'text','Slechts ' || round(r.draw_c * 100.0 / r.total) || '% gelooft nog in een gelijkspel bij ' || r.home_team || ' – ' || r.away_team || '.',
          'emoji','🤷'
        ));
      END IF;

      IF abs(r.home_w - r.away_w) <= GREATEST(1, r.total / 20) AND r.draw_c < r.home_w AND r.draw_c < r.away_w THEN
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','split_match',
          'text','Heetste match van de dag: bij ' || r.home_team || ' – ' || r.away_team || ' is de groep volledig verdeeld.',
          'emoji','⚖️'
        ));
      END IF;
    END IF;
  END LOOP;

  -- Meest gekozen exacte score per match vandaag
  FOR r IN
    SELECT m.home_team, m.away_team, p.predicted_home_score as hs, p.predicted_away_score as as_,
           count(*) as c,
           (SELECT count(*) FROM predictions p2 WHERE p2.match_id = m.id) as total
    FROM matches m
    JOIN predictions p ON p.match_id = m.id
    WHERE (m.match_date AT TIME ZONE 'Europe/Brussels')::date = today
      AND m.home_team <> 'TBD'
    GROUP BY m.id, m.home_team, m.away_team, p.predicted_home_score, p.predicted_away_score
    HAVING count(*) >= 2
    ORDER BY count(*) DESC
    LIMIT 4
  LOOP
    IF r.total >= 5 AND r.c::numeric / r.total >= 0.3 THEN
      stats := stats || jsonb_build_array(jsonb_build_object(
        'type','top_score',
        'text','De volkswijsheid voorspelt ' || r.home_team || ' – ' || r.away_team || ' ' || r.hs || '–' || r.as_ || ' (meest gekozen score).',
        'emoji','🎯'
      ));
    END IF;
    IF r.total >= 5 AND r.c::numeric / r.total >= 0.7 THEN
      stats := stats || jsonb_build_array(jsonb_build_object(
        'type','sheep',
        'text','Schaapjesgedrag: ' || round(r.c * 100.0 / r.total) || '% kiest exact dezelfde score bij ' || r.home_team || ' – ' || r.away_team || '.',
        'emoji','🐑'
      ));
    END IF;
  END LOOP;

  -- Topscorerland
  DECLARE total_bp int; BEGIN
    SELECT count(*) INTO total_bp FROM bonus_predictions WHERE topscorer_country IS NOT NULL AND topscorer_country <> '';
    IF total_bp >= 5 THEN
      FOR r IN
        SELECT topscorer_country as v, count(*) as c
        FROM bonus_predictions
        WHERE topscorer_country IS NOT NULL AND topscorer_country <> ''
        GROUP BY topscorer_country ORDER BY count(*) DESC LIMIT 1
      LOOP
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','topscorer',
          'text','Favoriet topscorerland: ' || r.v || ' (' || round(r.c * 100.0 / total_bp) || '%).',
          'emoji','⚽'
        ));
      END LOOP;
    END IF;
  END;

  -- Clean sheet
  DECLARE total_bp int; BEGIN
    SELECT count(*) INTO total_bp FROM bonus_predictions WHERE clean_sheet_country IS NOT NULL AND clean_sheet_country <> '';
    IF total_bp >= 5 THEN
      FOR r IN
        SELECT clean_sheet_country as v, count(*) as c
        FROM bonus_predictions
        WHERE clean_sheet_country IS NOT NULL AND clean_sheet_country <> ''
        GROUP BY clean_sheet_country ORDER BY count(*) DESC LIMIT 1
      LOOP
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','cleansheet',
          'text', r.v || ' is dé favoriet voor de clean-sheet-trofee (' || round(r.c * 100.0 / total_bp) || '% van de stemmen).',
          'emoji','🧤'
        ));
      END LOOP;
    END IF;
  END;

  -- Early exit
  DECLARE total_bp int; BEGIN
    SELECT count(*) INTO total_bp FROM bonus_predictions WHERE early_exit_country IS NOT NULL AND early_exit_country <> '';
    IF total_bp >= 5 THEN
      FOR r IN
        SELECT early_exit_country as v, count(*) as c
        FROM bonus_predictions
        WHERE early_exit_country IS NOT NULL AND early_exit_country <> ''
        GROUP BY early_exit_country ORDER BY count(*) DESC LIMIT 1
      LOOP
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','early_exit',
          'text', round(r.c * 100.0 / total_bp) || '% denkt dat ' || r.v || ' al vroeg sneuvelt.',
          'emoji','😬'
        ));
      END LOOP;
    END IF;
  END;

  -- Meest voorspelde finale
  DECLARE total_bp int; BEGIN
    SELECT count(*) INTO total_bp FROM bonus_predictions WHERE final_home_team IS NOT NULL AND final_away_team IS NOT NULL AND final_home_team <> '' AND final_away_team <> '';
    IF total_bp >= 5 THEN
      FOR r IN
        SELECT LEAST(final_home_team, final_away_team) as t1,
               GREATEST(final_home_team, final_away_team) as t2,
               count(*) as c
        FROM bonus_predictions
        WHERE final_home_team IS NOT NULL AND final_away_team IS NOT NULL AND final_home_team <> '' AND final_away_team <> ''
        GROUP BY 1,2 ORDER BY count(*) DESC LIMIT 1
      LOOP
        IF r.c >= 2 THEN
          stats := stats || jsonb_build_array(jsonb_build_object(
            'type','final',
            'text','Meest voorspelde finale: ' || r.t1 || ' vs ' || r.t2 || '.',
            'emoji','🏆'
          ));
        END IF;
      END LOOP;
    END IF;
  END;

  -- Top 3 finalisten (combinatie home + away)
  IF total_users >= 5 THEN
    DECLARE winners text; BEGIN
      SELECT string_agg(team, ' · ' ORDER BY rn) INTO winners FROM (
        SELECT team, row_number() OVER (ORDER BY cnt DESC) as rn
        FROM (
          SELECT team, count(*) as cnt FROM (
            SELECT final_home_team as team FROM bonus_predictions WHERE final_home_team IS NOT NULL AND final_home_team <> ''
            UNION ALL
            SELECT final_away_team FROM bonus_predictions WHERE final_away_team IS NOT NULL AND final_away_team <> ''
          ) t GROUP BY team ORDER BY cnt DESC LIMIT 3
        ) y
      ) x;
      IF winners IS NOT NULL THEN
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','top_finalists',
          'text','Top 3 finalisten volgens de groep: ' || winners || '.',
          'emoji','🥇'
        ));
      END IF;
    END;
  END IF;

  -- Aantal zonder prono voor vandaag
  DECLARE today_match_count int; users_without int; BEGIN
    SELECT count(*) INTO today_match_count FROM matches
      WHERE (match_date AT TIME ZONE 'Europe/Brussels')::date = today AND home_team <> 'TBD';
    IF today_match_count > 0 THEN
      SELECT count(*) INTO users_without FROM profiles pr
        WHERE profile_confirmed = true AND NOT EXISTS (
          SELECT 1 FROM predictions p
          JOIN matches m ON m.id = p.match_id
          WHERE p.user_id = pr.id
          AND (m.match_date AT TIME ZONE 'Europe/Brussels')::date = today
        );
      IF users_without > 0 THEN
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','missing',
          'text','Nog ' || users_without || ' deelnemer' || CASE WHEN users_without = 1 THEN '' ELSE 's' END || ' ' ||
                 CASE WHEN users_without = 1 THEN 'heeft' ELSE 'hebben' END || ' hun prono voor vandaag niet ingevuld.',
          'emoji','👀'
        ));
      END IF;
    END IF;
  END;

  -- Optimist van de dag
  DECLARE opt record; BEGIN
    SELECT m.home_team, m.away_team, p.predicted_home_score as hs, p.predicted_away_score as as_,
           (p.predicted_home_score + p.predicted_away_score) as totalg
    INTO opt
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    WHERE (m.match_date AT TIME ZONE 'Europe/Brussels')::date = today
      AND m.home_team <> 'TBD'
    ORDER BY (p.predicted_home_score + p.predicted_away_score) DESC,
             abs(p.predicted_home_score - p.predicted_away_score) DESC
    LIMIT 1;
    IF opt.totalg >= 5 THEN
      stats := stats || jsonb_build_array(jsonb_build_object(
        'type','optimist',
        'text','Optimist van de dag: iemand voorspelde ' || opt.home_team || ' – ' || opt.away_team || ' ' || opt.hs || '–' || opt.as_ || '. Geloof of waanzin?',
        'emoji','🤔'
      ));
    END IF;
  END;

  -- Saaie boel: % met <3 goals totaal vandaag
  DECLARE low_c int; tot_c int; BEGIN
    SELECT count(*) FILTER (WHERE p.predicted_home_score + p.predicted_away_score < 3), count(*)
    INTO low_c, tot_c
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    WHERE (m.match_date AT TIME ZONE 'Europe/Brussels')::date = today
      AND m.home_team <> 'TBD';
    IF tot_c >= 5 AND low_c::numeric / tot_c >= 0.5 THEN
      stats := stats || jsonb_build_array(jsonb_build_object(
        'type','boring',
        'text','Saaie boel verwacht: ' || round(low_c * 100.0 / tot_c) || '% denkt dat er vandaag minder dan 3 goals vallen.',
        'emoji','😴'
      ));
    END IF;
  END;

  RETURN stats;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_crowd_stats() TO anon, authenticated;
