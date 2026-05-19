## Doel

De gekozen "Subtiel editorial v2"-richting (FIFA WK 2026 sfeer) wordt het visuele systeem van de hele app — niet alleen het loginscherm. Donkere tournament-energie waar het past, witte content-cards waar leesbaarheid telt, met paars (#3D00FF), lime (#BAFF00) en goud als WK-accenten naast de bestaande WelZeker teal.

## Designsysteem (de basis)

Eén plek waar alles vandaan komt: `src/styles.css` krijgt nieuwe semantische tokens. Components verwijzen ernaar via Tailwind classes (`bg-tournament`, `text-wc-purple`, etc.) — geen losse hex-codes verspreid door de codebase.

Nieuwe tokens:
- `--tournament-bg` — diep zwart (#050505) voor hero-momenten en login
- `--wc-purple` — FIFA-paars als secundaire accent voor highlights en focus-states
- `--wc-lime` — lime als attention-accent (badges, alerts, success-cijfers)
- `--wc-gold` — voor trofee/winnaars
- `--surface-elevated` — witte cards blijven, krijgen zachtere shadow + grotere radius
- `--radius` van 0.75rem → 1rem (rondere, modernere feel)

Primary blijft WelZeker teal — paars wordt een accent, geen vervanging.

Fonts: Oswald (display, uppercase H1's), Archivo Black (numerieke statements, "26", scores), Inter (body, ongewijzigd). Toegevoegd via Google Fonts `<link>` in `__root.tsx` head.

## Per-scherm aanpassingen

**Login (`/login`)** — volledig herschreven naar de gekozen richting: zwarte achtergrond met paars+lime gradient-glows, ruit-patroon overlay, witte card met grote "26" logo-mark, gouden trofee, Oswald typografie. Zoals de gekozen prototype.

**Header (`Header.tsx`)** — blijft sticky en functioneel, maar krijgt Oswald-titel "WK 2026 PRONO" in uppercase, dunne paarse onderlijn als tournament-cue, gerefijnde avatar-knop.

**BottomNav (`BottomNav.tsx`)** — actieve tab krijgt korte paarse top-bar (i.p.v. alleen kleurverandering); bonus-badge wordt lime i.p.v. amber.

**Dashboard (`/dashboard`)** — hero-strip bovenaan met "MATCHDAY" mini-eyebrow, grote Oswald begroeting, "Jouw punten" stat-card als donker tournament-blok (zwart met paarse glow), andere twee stats blijven licht. Lijst-items voor "te voorspellen" krijgen genummerde Archivo Black match-nummers en lime "soon"-badges.

**Prono (`/prono`)** — match-cards krijgen subtiele linker accent-bar in paars, scores in Archivo Black, locked-state in donkergrijs met lock-icon. Filtertabs voor fases in uppercase Oswald.

**Klassement (`/klassement`)** — top-3 podium-blok bovenaan met goud/zilver/brons accenten, rank-cijfers in Archivo Black. "Jij" rij gehighlight met paarse linker-bar.

**KO-schema (`/ko-schema`)** — bracket-lijnen in muted teal, ronde-titels ("ACHTSTE FINALES" etc.) in Oswald uppercase met paarse accent-stip ervoor.

**Bonus (`/bonus`)** — progress-tracker bovenaan als donker tournament-blok met lime voortgangsbalk. Bonusvraag-cards behouden hun layout, krijgen iconen op gekleurde achtergronden (paars/lime/teal/goud per vraagtype).

**Admin (`/admin`)** — tab-strip in Oswald uppercase, status-pills strakker, sync-log entries met monospace tijden. Subtieler — admin moet functioneel blijven.

**404 / error-pagina's (`__root.tsx`)** — grote Archivo Black "404" in paars, zwarte achtergrond-glow.

## Wat niet verandert

- Routing, auth-flow, sessie-logica (`auth.tsx`).
- Database, server functions, sync-engine, scoring.
- shadcn-component APIs — alleen hun styling via tokens.
- Functionele copy/teksten (op de hero-eyebrows na).

## Technische aanpak

1. Tokens uitbreiden in `src/styles.css` (zwart, paars, lime, goud, radius, shadows).
2. Google Fonts toevoegen aan `__root.tsx` head().
3. Twee kleine herbruikbare componenten introduceren:
   - `<SectionEyebrow>` — uppercase tracked label met paarse stip (gebruikt op dashboard, prono, klassement headers).
   - `<TournamentCard>` — donkere kaart met paarse glow voor hero-stats.
4. Bestaande componenten editen: `login.tsx`, `Header.tsx`, `BottomNav.tsx`, `dashboard.tsx`, `prono.tsx`, `klassement.tsx`, `ko-schema.tsx`, `bonus.tsx`, `admin.tsx`, `__root.tsx` (error/404 + fonts).
5. Visuele QA per scherm in de preview na implementatie.

## Resultaat

Eén samenhangende WK 2026-identiteit door de hele app: donkere tournament-momenten op hero-stukken en login, lichte werkbare cards op data-rijke schermen, consistent typografisch systeem (Oswald/Archivo Black/Inter) en een palet waarin WelZeker teal én FIFA paars/lime naast elkaar leven zonder elkaar te beconcurreren.