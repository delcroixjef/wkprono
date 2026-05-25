# Checklist — Remix opzetten voor een nieuwe groep

Volg deze stappen in volgorde nadat je via de drie-puntjes (⋯) → **Remix** een kopie van het project hebt gemaakt. De remix krijgt automatisch een **nieuwe, lege Lovable Cloud backend** (eigen database, eigen secrets), dus niets loopt door elkaar met WelZeker.

## 1. Project hernoemen

- Klik linksboven op de projectnaam → **Rename project** → bv. `WK 2026 Prono — Familie`.
- Dit bepaalt ook de standaard publish-URL (bv. `wkprono-familie.lovable.app`).

## 2. Branding in de code aanpassen

Drie plekken waar "WelZeker" / "WK 2026 Prono" letterlijk in de code staat:

- **`src/components/Header.tsx`** — regels met `WK 2026 Prono` en `WelZeker` (titel + ondertitel in de header).
- **`src/components/Logo.tsx`** — `aria-label="WelZeker"` aanpassen naar je nieuwe groepsnaam.
- **`src/routes/login.tsx`** — titel `WK 2026 Prono` en regel `Interne challenge — WelZeker` op de loginpagina.

Optioneel: kleurenpalet in `src/styles.css` aanpassen als je een andere look wil per groep (bv. familie = warmer, vrienden = donkerder).

## 3. Secrets opnieuw instellen

De remix start met een **lege** secrets-lijst. Voeg minimaal toe:

- **`JOIN_CODE`** — nieuwe deelnamecode voor deze groep (bv. `FAMILIE2026`). Dit is wat deelnemers op de loginpagina invullen.
- **`SYNC_SECRET`** — willekeurige string; nodig voor het `/api/public/hooks/sync-results` endpoint dat de openfootball-uitslagen ophaalt.

Automatisch aanwezig (niet zelf toevoegen): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_URL`, `LOVABLE_API_KEY`.

**Niet nodig** in deze remix (mails zijn uit):
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_DIGEST_SECRET`

## 4. Mail-functionaliteit uitschakelen

Aangezien de dagelijkse digest-mails niet meer gebruikt worden:

- Eventuele cron-job / scheduler die `/api/public/hooks/...` voor mails aanroept: niet opnieuw configureren in de remix.
- Lovable Emails uitzetten via **Connectors → Lovable Email → disable** (voorkomt dat er per ongeluk auth-/transactionele mails uitgaan).
- Code-opkuis is optioneel — ongebruikte email-helpers doen geen kwaad als ze niet aangeroepen worden, maar je kan ze later verwijderen voor netheid.

## 5. Eerste admin aanmaken

In de nieuwe (lege) database is er nog geen admin:

1. Eén keer inloggen op de remix met je naam + e-mail + de nieuwe `JOIN_CODE`. Dit maakt een rij in `profiles`.
2. In Lovable Cloud → Database → `profiles` tabel → jouw rij → `is_admin` op `true` zetten.
3. Daarna verschijnt het **Admin**-menu en kan je wedstrijden beheren.

## 6. Wedstrijden & sync

De wedstrijdenlijst (poules, KO-schema) zit **niet** automatisch in een verse database. Twee opties:

- **A. Automatisch via sync** — Zodra de openfootball-data live is, roept het sync-endpoint uitslagen op en koppelt ze aan bestaande matches. Maar je moet eerst de basis-matches (datum, teams, match_number) zelf inladen. Het simpelst: laat Lovable de seed-migratie uit het origineel kopiëren naar de remix.
- **B. Manueel** — Via het Admin-paneel matches één voor één toevoegen (alleen praktisch als je met een klein toernooi/groep wil testen).

Sync-endpoint zelf: blijft `/api/public/hooks/sync-results` met header `x-sync-secret: <jouw nieuwe SYNC_SECRET>`. Eventuele externe cron (bv. cron-job.org) opnieuw instellen met de **nieuwe** URL + nieuwe secret.

## 7. Publish & delen

- Klik rechtsboven op **Publish** → kies de nieuwe subdomein-naam (bv. `wkprono-familie.lovable.app`).
- Test op een tweede toestel: login met de nieuwe `JOIN_CODE` werkt, klassement start op nul.
- Deel de URL + code met de groep.

## 8. Optioneel — bonusvragen & favorieten

- `src/lib/teams.ts` bevat de `TOP_10_FAVORITES` lijst die gebruikt wordt voor de "vroege uitschakeling"-bonus. Hoeft normaal niet aangepast.
- Bonusvragen zelf (topscorer, clean sheet, finale) worden per deelnemer ingevuld via `/bonus` — geen code-aanpassing nodig.

---

**Samenvatting van wat je écht móet doen per remix:** project hernoemen → 3 branding-tekstjes → `JOIN_CODE` + `SYNC_SECRET` secrets → eerste admin promoveren → wedstrijden seeden → publish. De rest is optioneel.
