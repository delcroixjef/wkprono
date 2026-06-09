## Probleem

In de admin-pagina staan 6 tabs (Sync, Prono-status, Uitslagen, Bonus, Deelnemers, Vergrendelen) in een `grid grid-cols-6`. Op een 360 px-scherm krijgt elke tab ~60 px en lopen de labels over elkaar — onleesbaar (zie screenshot).

## Oplossing

In `src/routes/_authenticated/admin.tsx` de `TabsList` van een 6-koloms grid omzetten naar een **horizontaal scrollbare rij** met tabs op hun natuurlijke breedte. Dit is de gebruikelijke mobiele aanpak en houdt de desktop-ervaring nagenoeg gelijk.

### Concreet

- `TabsList` krijgt: `flex w-full overflow-x-auto no-scrollbar justify-start gap-1 h-auto` (i.p.v. `grid w-full grid-cols-6`).
- Elke `TabsTrigger` krijgt: `flex-shrink-0 whitespace-nowrap px-3` zodat labels niet afgekapt of gewrapt worden.
- Subtiele scroll-hint: rechterrand fade via een lichte `mask-image` op de container (optioneel, alleen op mobiel).
- Geen wijziging aan tab-inhoud, volgorde, of gedrag.

### Niet in scope

- Geen herordening of samenvoegen van tabs.
- Geen wijziging aan de header (logo/bal/initialen) — dat staat los van deze fix.
- Geen wijzigingen aan andere pagina's met tabs.

## Bestand

- `src/routes/_authenticated/admin.tsx` — alleen regels 38–45 (TabsList + TabsTriggers).
