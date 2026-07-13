# Kronos — koncept

*Brainstorming 2026-06-12; 4. kolo: pivot na kanban nástěnky (Trello × Toggl).*

## Pitch

Firemní nástroj pro vlastní firmy: každý projekt je **Trello-style kanban nástěnka**
(libovolné sloupce, karty s popisem, přiřazením, termínem a komentáři) a nad tím
běží **timer** — spustitelný z karty, nebo volně jen na projekt. Admini
(společníci/manažeři) vidí přehledy hodin po lidech a projektech. Vlastní data,
žádné předplatné.

## Pro koho a proč

- **Uživatelé (members):** zaměstnanci/spolupracovníci vlastních firem (každá firma
  = workspace). Jeden uživatel může být ve více firmách, v UI přepínač workspace.
- **Admini (manažeři):** vidí a spravují dění ve svém workspace; více adminů na workspace.
- **Super-admin:** spravuje aplikaci — zakládá workspaces (firmy), jmenuje adminy.
  Workspace nejde založit svépomocí.
- **Motivace stavět vlastní:** kontrola nad daty a rozšiřováním, cena existujících nástrojů.

## Core loop

1. Uživatel se přihlásí a vidí dlaždice projektů (nástěnek) svého workspace.
2. Na nástěnce přesouvá karty mezi sloupci (drag & drop), zakládá karty a sloupce,
   v detailu karty komentuje a odškrtává hotovo.
3. U karty spustí **timer**, nebo spustí **volný timer** (váže se na projekt +
   volitelný popis). Zastavením vznikne záznam; čas jde zapsat i ručně zpětně.
4. Admin se kdykoli podívá na přehled: hodiny po lidech a projektech za období.

## Scope

### MVP
- Workspaces (multi-tenant), role member / admin / super-admin, pozvánky e-mailem
  — beze změny z dřívějších kol
- Projekt = nástěnka: **libovolné sloupce** (přidat/přejmenovat/smazat/přeřadit),
  nový projekt začíná s prázdnou nástěnkou
- Karty: titulek, popis, přiřazení, termín, **hotovo = checkbox nezávislý na
  sloupci**, **komentáře** (bez notifikací); zakládá kterýkoli člen
- **Plné drag & drop** (@dnd-kit): karty mezi sloupci i v rámci sloupce, řazení sloupců
- Timer: z karty i **volný** — volný záznam má povinný projekt + volitelný popis;
  max. 1 běžící timer na uživatele; globální lišta s běžícím časem
- Můj čas: záznamy po dnech, ruční zápis (projekt povinný, karta volitelná), editace
- Přehledy pro adminy: hodiny po lidech a po projektech (přímo z `time_entries.project_id`)
- Responzivní web, česky

### v2
- Notifikace (komentáře, přiřazení karty)
- Pohled „Moje úkoly" napříč projekty (v 4. kole odstraněn z domova)
- Štítky, checklisty, přílohy na kartě
- Sazby a peníze v přehledech; CSV export
- Agregovaný dashboard super-admina napříč firmami; jemnější oprávnění
- Offline režim timeru

### Non-goals (maybe never)
- Tagy mimo nástěnku, nativní mobilní appka, fakturace, multi-měny, veřejný SaaS

## Stack a klíčová rozhodnutí

| Rozhodnutí | Volba | Proč |
|---|---|---|
| Framework | Next.js (App Router) na Vercelu | Preferovaný stack, zero-ops |
| DB + Auth | Supabase (Postgres + RLS + Auth) | Multi-tenant izolace, pozvánky out-of-the-box |
| Tenancy | `workspace_members` (user × workspace × role) | Více firem na uživatele zdarma |
| Super-admin | Flag na profilu; jen on zakládá workspaces | Centrální správa, žádný self-serve |
| Nástěnka | `board_columns` (position float) + `tasks.column_id/position` | Fractional ordering — DnD bez přeindexování |
| Hotovo | `tasks.completed_at` nezávislé na sloupci | Uživatelovo rozhodnutí (4. kolo) |
| Volný timer | `time_entries.task_id` nullable, `project_id` povinný + denormalizovaný | Přehledy po projektech vždy úplné |
| Komentáře | `task_comments` (author, body) | MVP bez notifikací |
| DnD | @dnd-kit | Standard pro React, aktivně udržovaný |

## Rizika

1. **Scope creep** — 4 kola změn zadání (toggl → +sazby → ořez → úkoly v core →
   kanban+komentáře). Největší riziko zůstává nedotáhnutí. Obrana: v2 seznam závazný.
2. **DnD složitost** — nejpracnější UI kus; držet jednoduchou variantu (bez animací
   napříč nástěnkami, bez optimistických konfliktů — poslední zápis vyhrává).
3. **Komentáře bez notifikací** — riziko „psal jsem ti to do karty"; vědomě přijato.
4. **Zánik pohledu napříč projekty** — člověk s úkoly v 5 projektech musí obejít
   5 nástěnek; pokud to bude bolet, vrátí se „Moje úkoly" jako v2.
5. **Adopce ve firmě** — nasadit nejdřív pro jednu firmu na 2 týdny, pak rozšířit.

## Otevřené otázky

- Vidí member nástěnky všech projektů workspace, nebo jen „svých"? (MVP: všech —
  shoduje se s dosavadní RLS; zúžení případně v2)
- Mazání neprázdného sloupce: MVP blokuje (karty nejdřív přesunout).
- Pojmenování produktu — „Kronos" (dříve pracovně „Toggled"); produkce kronos.digitalized.cz.
