
## Doel

Twee nieuwe admin-functies toevoegen onder `/admin`:

1. **Prono-status**: zien wie zijn voorspellingen al heeft ingevuld voor de eerstvolgende wedstrijden (vóór de deadline).
2. **Deelnemersbeheer uitbreiden**: deelnemers kunnen **locken** (geen wijzigingen meer mogelijk) of **verwijderen**.

## 1. Nieuwe tab "Prono-status"

Nieuwe tab in `src/routes/_authenticated/admin.tsx` naast de bestaande (Sync, Uitslagen, Bonus, Deelnemers, Vergrendelen).

**Scope "volgende wedstrijden":** alle wedstrijden van de eerstvolgende speeldag die nog niet voorbij is (zelfde logica als `matchday_deadline` — alle matches op dezelfde Brussels-datum als de eerstvolgende toekomstige match). De deadline = 30 min vóór de eerste match van die dag.

**UI per deelnemer (alleen `profile_confirmed = true`):**
- Naam + initialen
- Aantal pronos ingevuld / totaal matches van die speeldag (bv. `3/4`)
- Status-badge:
  - ✅ **Volledig** (alles ingevuld)
  - ⚠️ **Deels** (sommige ingevuld)
  - ❌ **Niets** (geen enkele)
- Countdown tot deadline bovenaan ("Deadline over 2u 13min")
- Filter: "Toon enkel onvolledige"
- Per deelnemer: lijstje met ontbrekende matches (uitklapbaar)

**Data:** één server function `getProgressForNextMatchday()` (`src/lib/admin-progress.functions.ts`) met `requireSupabaseAuth` + admin-check, die teruggeeft:
```ts
{
  deadline: string | null,
  matches: { id, home_team, away_team, match_date }[],
  participants: { id, display_name, avatar_initials, filled_count, missing_match_ids: string[] }[]
}
```
Refetcht elke 30s.

## 2. Tab "Deelnemers" uitbreiden

Bestaande `UsersTab` aanpassen — naast admin-toggle:

- **Lock-toggle** per deelnemer: bevriest al hun voorspellingen (geen edits meer toegelaten, ook al is de deadline nog niet voorbij).
- **Verwijder-knop** (rood, met bevestigingsdialog): verwijdert profiel + alle gerelateerde data (predictions, bonus_predictions, bonus_points). Auth-user blijft bestaan (kunnen we niet client-side verwijderen), maar `profile_confirmed` wordt `false` en data is weg.

### Schemawijzigingen (migratie)

- Kolom `profiles.is_locked boolean not null default false` toevoegen.
- Trigger `predictions_deadline_trigger` uitbreiden: ook blokkeren als `profiles.is_locked = true` voor de user.
- Idem voor `bonus_predictions` (nieuwe trigger of toevoeging aan bestaande lock-check).

### Server function voor verwijderen

`deleteParticipant({ userId })` (`src/lib/admin-users.functions.ts`) met `requireSupabaseAuth` + admin-check:
1. Verifieer dat de caller admin is.
2. Cascade delete via `supabaseAdmin`: `predictions`, `bonus_predictions`, `bonus_points`, `profiles`.
3. (Auth user in `auth.users` blijft — verwijderen vereist service-role admin API; optioneel later.)

Lock-toggle gebeurt gewoon via `UPDATE profiles SET is_locked = ...` (admin-only, beschermd door RLS — RLS-policy moet `is_admin()` check krijgen voor updates van andere profielen). Aangezien huidige RLS `profiles_anon_all` met `true` toelaat, werkt dit, maar we voegen tegelijk een nettere check toe in de server function.

## Bestanden

**Nieuw**
- `src/lib/admin-progress.functions.ts` — `getProgressForNextMatchday`
- `src/lib/admin-users.functions.ts` — `deleteParticipant`, `setParticipantLocked`
- `supabase/migrations/<ts>_admin_participant_lock.sql`

**Aangepast**
- `src/routes/_authenticated/admin.tsx` — extra tab "Prono-status", uitgebreide `UsersTab` (lock + delete + bevestigingsdialog)

## Open vragen

1. **Verwijderen — wat precies?** Volledig wissen (predictions, bonus, profile) of enkel deactiveren (`profile_confirmed=false`, data behouden)?
2. **Lock — alleen pronos of ook inloggen blokkeren?** Inloggen blokkeren vereist auth-admin API; ik stel voor: alleen pronos bevriezen (eenvoudiger en omkeerbaar).
3. **"Volgende wedstrijden"** = eerstvolgende speeldag (alle matches die dag). OK, of liever volgende N=1 enkele match?
