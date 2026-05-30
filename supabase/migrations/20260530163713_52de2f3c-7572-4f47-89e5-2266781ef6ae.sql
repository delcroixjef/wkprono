
CREATE OR REPLACE FUNCTION public.get_crowd_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  stats jsonb := '[]'::jsonb;
  today date := (now() AT TIME ZONE 'Europe/Brussels')::date;
  total_users int;
  r record;
  min_pct_users int := 2; -- verlaagde drempel
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
    IF r.total >= min_pct_users THEN
      IF r.home_w >= r.away_w AND r.home_w >= r.draw_c AND r.home_w::numeric / r.total >= 0.5 THEN
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','match_outcome',
          'text', round(r.home_w * 100.0 / r.total) || '% van de bende denkt dat ' || r.home_team || ' wint van ' || r.away_team || '. De rest leeft gevaarlijk.',
          'emoji','🔥'
        ));
      ELSIF r.away_w >= r.home_w AND r.away_w >= r.draw_c AND r.away_w::numeric / r.total >= 0.5 THEN
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','match_outcome',
          'text', round(r.away_w * 100.0 / r.total) || '% gokt op ' || r.away_team || ' tegen ' || r.home_team || '. Durvers of betweters?',
          'emoji','🔥'
        ));
      ELSIF r.draw_c >= r.home_w AND r.draw_c >= r.away_w THEN
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','match_draw_fav',
          'text','Bij ' || r.home_team || ' – ' || r.away_team || ' gokt de meerderheid op een gelijkspel. Saai of slim?',
          'emoji','🤝'
        ));
      END IF;

      IF abs(r.home_w - r.away_w) <= 1 AND r.home_w > 0 AND r.away_w > 0 THEN
        stats := stats || jsonb_build_array(jsonb_build_object(
          'type','split_match',
          'text','Bij ' || r.home_team || ' – ' || r.away_team || ' is het groepje volledig verdeeld. Pure muntstuk-materie.',
          'emoji','⚖️'
        ));
      END IF;
    END IF;
  END LOOP;

  -- Meest gekozen exacte score per match vandaag (drempel ≥2)
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
    LIMIT 3
  LOOP
    stats := stats || jsonb_build_array(jsonb_build_object(
      'type','top_score',
      'text','Volkswijsheid bij ' || r.home_team || ' – ' || r.away_team || ': ' || r.hs || '–' || r.as_ || ' (meest gekozen). Origineel hé.',
      'emoji','🎯'
    ));
  END LOOP;

  -- Topscorerland (drempel ≥2)
  FOR r IN
    SELECT topscorer_country as v, count(*) as c,
      (SELECT count(*) FROM bonus_predictions WHERE topscorer_country IS NOT NULL AND topscorer_country <> '') as total
    FROM bonus_predictions
    WHERE topscorer_country IS NOT NULL AND topscorer_country <> ''
    GROUP BY topscorer_country ORDER BY count(*) DESC LIMIT 1
  LOOP
    IF r.c >= 2 THEN
      stats := stats || jsonb_build_array(jsonb_build_object(
        'type','topscorer',
        'text','Favoriet topscorerland: ' || r.v || ' (' || r.c || ' stemmen). Hopen dat hun spits niet geblesseerd raakt.',
        'emoji','⚽'
      ));
    END IF;
  END LOOP;

  -- Clean sheet (drempel ≥2)
  FOR r IN
    SELECT clean_sheet_country as v, count(*) as c
    FROM bonus_predictions
    WHERE clean_sheet_country IS NOT NULL AND clean_sheet_country <> ''
    GROUP BY clean_sheet_country ORDER BY count(*) DESC LIMIT 1
  LOOP
    IF r.c >= 2 THEN
      stats := stats || jsonb_build_array(jsonb_build_object(
        'type','cleansheet',
        'text', r.v || ' is dé favoriet voor de clean-sheet-trofee. Eén goal en het feestje is gedaan.',
        'emoji','🧤'
      ));
    END IF;
  END LOOP;

  -- Early exit (drempel ≥2)
  FOR r IN
    SELECT early_exit_country as v, count(*) as c
    FROM bonus_predictions
    WHERE early_exit_country IS NOT NULL AND early_exit_country <> ''
    GROUP BY early_exit_country ORDER BY count(*) DESC LIMIT 1
  LOOP
    IF r.c >= 2 THEN
      stats := stats || jsonb_build_array(jsonb_build_object(
        'type','early_exit',
        'text', r.c || ' deelnemers denken dat ' || r.v || ' al vroeg op het vliegtuig zit. Awkward.',
        'emoji','😬'
      ));
    END IF;
  END LOOP;

  -- Meest voorspelde finale (drempel ≥2)
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
        'text','Meest voorspelde finale: ' || r.t1 || ' vs ' || r.t2 || '. Niet bepaald origineel.',
        'emoji','🏆'
      ));
    END IF;
  END LOOP;

  -- Top 3 finalisten (altijd als er data is)
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
        'text','Top 3 finale-favorieten: ' || winners || '. Iemand moet hier de mist mee ingaan.',
        'emoji','🥇'
      ));
    END IF;
  END;

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
          'text', users_without || ' deelnemer' || CASE WHEN users_without = 1 THEN '' ELSE 's' END || ' ' ||
                 CASE WHEN users_without = 1 THEN 'is' ELSE 'zijn' END || ' nog aan het twijfelen voor vandaag. Tik-tak.',
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
    IF opt.totalg >= 4 THEN
      stats := stats || jsonb_build_array(jsonb_build_object(
        'type','optimist',
        'text','Optimist van de dag: iemand voorspelde ' || opt.home_team || ' – ' || opt.away_team || ' ' || opt.hs || '–' || opt.as_ || '. Geloof of pure waanzin?',
        'emoji','🤔'
      ));
    END IF;
  END;

  -- Pessimist van de dag (laagste totaal)
  DECLARE pes record; BEGIN
    SELECT m.home_team, m.away_team, p.predicted_home_score as hs, p.predicted_away_score as as_,
           (p.predicted_home_score + p.predicted_away_score) as totalg
    INTO pes
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    WHERE (m.match_date AT TIME ZONE 'Europe/Brussels')::date = today
      AND m.home_team <> 'TBD'
    ORDER BY (p.predicted_home_score + p.predicted_away_score) ASC
    LIMIT 1;
    IF pes.totalg IS NOT NULL AND pes.totalg <= 1 THEN
      stats := stats || jsonb_build_array(jsonb_build_object(
        'type','pessimist',
        'text','Pessimist van de dag verwacht ' || pes.home_team || ' – ' || pes.away_team || ' ' || pes.hs || '–' || pes.as_ || '. Iemand heeft slecht geslapen.',
        'emoji','😴'
      ));
    END IF;
  END;

  -- Algemene fun fact: totaal aantal pronos
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

  -- Gemiddeld aantal goals per prono
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
