# WelZeker WK Prono — Optimalisatieplan

Een grote, samenhangende opkuis. Ik groepeer het werk in 7 blokken die overeenkomen met de prioriteiten. Alle wijzigingen blijven binnen de bestaande TanStack Start + Lovable Cloud opzet.

## 1. Robuuste automatische sync

**Database (migratie):**
- `matches.source` toevoegen: `text` met default `'auto'`, check waarden `auto|manual|corrected`
- `matches.auto_sync_override` boolean default `true` — als `false` mag sync deze match niet overschrijven
- `matches.last_synced_at`, `matches.last_synced_score` (jsonb) voor diff-detectie
- `predictions.points_breakdown` jsonb (correct_outcome, correct_diff, exact_score, near_goals)
- Functie `calculate_match_points` uitbreiden zodat ze de breakdown opslaat en idempotent is
- Trigger op `matches` UPDATE → bij score-wijziging automatisch `calculate_match_points` aanroepen
- Trigger op `predictions` INSERT/UPDATE: weiger als `match_date <= now()` of `is_locked = true` (server-side deadline lock)

**Sync engine (`src/lib/sync.server.ts`):**
- Koppeling primair op `match_number` (via openfootball `num`), fallback op teamnamen
- Bij gewijzigde uitslag: update en herbereken (niet enkel bij eerste vulling)
- Respecteer `source='manual'` + `auto_sync_override=false`
- Detecteer wijziging via vergelijking met `last_synced_score`
- Set `source='auto'` bij sync, log alles in `sync_log` met juiste velden

**Beveiliging endpoint:**
- `/api/public/hooks/sync-results` verifieert `?secret=` query OF `x-sync-secret` header tegen `SYNC_SECRET` env var
- Vraag secret aan via `secrets--add_secret`

## 2. Cron planning

- pg_cron jobs op 20:00, 22:30, 01:00, 03:30, 06:30 Europe/Brussels → omzetten naar UTC (UTC+1 winter / UTC+2 zomer; WK 2026 = juni/juli = UTC+2, dus 18:00, 20:30, 23:00, 01:30, 04:30 UTC)
- Roept `https://wkprono.lovable.app/api/public/hooks/sync-results?secret=...` aan
- Admin tab toont: laatste succes, laatste fout, geplande volgende run (berekend uit cron schedule), aantal updates

## 3. Manueel adminwerk minimaliseren

- Admin "Wedstrijden" tab: lijst met automatische uitslagen + badge `auto` / `handmatig` / `gecorrigeerd`
- Aparte sectie "Handmatige correctie" (collapsible, secundair)
- Bij manueel overschrijven: set `source='corrected'`, `auto_sync_override` toggle
- Direct herberekenen via DB-trigger

## 4. Puntentelling

- Regels in DB-functie: 10 (exact), 5 (W/G/V), 5 (doelsaldo), 3 (bijna-juist drempel: |pred_total - act_total| ≤ 1 EN juiste richting)
- `predictions.points_breakdown` jsonb met de 4 sub-punten
- UI toont breakdown in match-detail en klassement-popover

## 5. Lichte deelnamecontrole

- `ALLOWED_EMAIL_DOMAINS` env (csv, bv. `welzeker.be`) OF `JOIN_CODE` env
- Login-form: valideer domein client-side + server-side via een nieuwe `validate_signin` server function
- DB-trigger voor predictions deadline (zie blok 1)

## 6. Look & feel

- `rounded-2xl` → `rounded-lg` over de hele app (find/replace per route)
- Compactere cards: kleinere padding, subtielere borders
- Encoding-fix: controle van alle .tsx bestanden op kapotte chars (`Ã©` etc.); `<meta charset="utf-8">` in `__root.tsx`
- Score-input component met +/- knoppen voor mobiel
- Match-status badge component (`Open` / `Sluit binnenkort` / `Gesloten` / `Auto opgehaald` / `Handmatig gecorrigeerd`)
- Nav vereenvoudigen: Home, Prono, Klassement, Wedstrijden, Admin
- Bonus + KO-schema worden subtabs binnen `/prono`

## 7. Wedstrijdenpagina

- Nieuwe route `/wedstrijden` (of vernieuwde bestaande)
- Filters: ronde (fase), groep, status
- Per wedstrijd: kickoff, status-badge, echte uitslag (indien beschikbaar)
- Na aftrap: lijst voorspellingen collega's + distributie (bv. "5×2-1, 3×1-1")
- Vóór aftrap: enkel eigen voorspelling

## Volgorde van uitvoering

1. Secret `SYNC_SECRET` aanvragen
2. DB-migratie (alle schema-wijzigingen + nieuwe scoring functie + deadline trigger)
3. Sync engine herschrijven (`sync.server.ts`)
4. Hook endpoint security
5. pg_cron jobs instellen
6. Admin sync-tab uitbreiden + wedstrijden-beheer met source-badges
7. Predictions UI: +/- knoppen, status-badges, breakdown weergave
8. Nieuwe `/wedstrijden` pagina
9. Nav simplificatie + bonus/KO als subtabs in `/prono`
10. Globale visuele opkuis (rounded-lg, encoding, charset)
11. Login-domein/code validatie

## Vragen vóór ik begin

- **Deelnamecontrole**: e-maildomein whitelist (welke domeinen?) of één join-code?
- **Sync-secret**: ik vraag een willekeurige string als `SYNC_SECRET` — akkoord?
- **Externe cron**: pg_cron in Lovable Cloud is beschikbaar — ik gebruik die. Akkoord, of wens je externe cron (cron-job.org) als documentatie?

Dit is groot werk. Ik wacht je akkoord (en antwoorden op de 3 vragen) af voor ik begin.
