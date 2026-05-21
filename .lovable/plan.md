## Vereenvoudigde puntentelling

Vervang de huidige 4-laagse scoring door één simpele regel per match:

| Voorspelling | Punten |
|---|---|
| Exacte uitslag (bv. voorspeld 2-1, werd 2-1) | **5 pt** |
| Juiste winnaar of gelijkspel (zonder exacte uitslag) | **3 pt** |
| Fout | 0 pt |

Bonusvragen blijven ongewijzigd: topscorer 5, clean sheets 5, vroege uitschakeling 8, finale exact 15.

### Waarom dit goed werkt
- Eén zin uit te leggen in de handleiding
- Nacontrole is triviaal (winnaar klopt → 3, klopt exact → 5)
- Exacte voorspelling blijft het meeste waard, dus durven loont nog steeds
- Bonusvragen krijgen relatief meer gewicht — past goed bij een speelse pool

---

## Wat er wijzigt

### 1. Database — `calculate_match_points` functie herschrijven
De PL/pgSQL functie wordt drastisch korter:
- weg: `diff_pts` (doelsaldo), `near_pts` (bijna-juist), bijbehorende berekeningen
- behoud: exact-check → 5 pt, anders winner-check → 3 pt
- `points_breakdown` jsonb wordt `{ exact: 0|5, outcome: 0|3 }` (alleen die 2 velden)

### 2. Bestaande data herberekenen
Na de migratie wordt `recalculate_all_points()` aangeroepen zodat alle reeds gespeelde matches de nieuwe score-logica volgen. (Op dit moment normaal nog 0 matches gespeeld, dus geen impact — maar voor de zekerheid.)

### 3. Frontend — breakdown-weergave
Plaatsen waar `points_breakdown` getoond wordt (match-detail, klassement-popover, eventueel `/wedstrijden`) moeten enkel nog `exact` en `outcome` tonen. De keys `diff` en `near` worden niet meer gevuld.

Bestanden om na te kijken & aanpassen:
- `src/routes/_authenticated/prono.tsx`
- `src/routes/_authenticated/klassement.tsx`
- `src/routes/_authenticated/wedstrijden.tsx`
- `src/routes/_authenticated/dashboard.tsx`
- eventuele helper in `src/lib/format.ts`

### 4. Handleiding (PDF)
Aparte wijzigingsprompt voor jouw Codex-flow om pagina 7 te vervangen door de nieuwe simpele regel. Levert ik mee na implementatie.

---

## Wat NIET wijzigt
- Bonuspunten (topscorer/clean sheet/vroege uitschakeling/finale)
- Sync-logica (verlengingen blijven meetellen, penalty's niet)
- Deadline-regels (30 min vóór eerste match van de dag)
- Auth, RLS, admin-pagina

---

## Volgorde
1. DB-migratie: nieuwe `calculate_match_points` + meteen `recalculate_all_points()` aanroepen in dezelfde migratie
2. Frontend breakdown-componenten opschonen (verwijder doelsaldo/bijna-juist labels)
3. Nieuwe wijzigingsprompt voor de PDF-handleiding aanleveren

Akkoord om dit zo door te voeren?
