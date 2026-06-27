# Architecture

This document explains how doc_scheduler is organised, how the scheduling engine works, and
the key design decisions (several of which came out of an adversarial design review).

## Directory layout

```
doc_scheduler/
├─ supabase/
│  └─ schema.sql              # tables + RLS + ownership/integrity triggers
├─ scripts/
│  └─ validate.ts             # runs the engine on real fixtures, asserts fairness
├─ src/
│  ├─ app/                    # Next.js App Router
│  │  ├─ layout.tsx           # wraps the app in the i18n provider
│  │  ├─ page.tsx             # demo: load -> generate (worker) -> table -> export
│  │  └─ globals.css
│  ├─ i18n/
│  │  ├─ messages.ts          # typed TR/EN dictionaries (en is the canonical shape)
│  │  └─ I18nProvider.tsx     # locale context + toggle, persisted to localStorage
│  └─ lib/
│     ├─ scheduler/           # the engine (framework-free, pure TS)
│     │  ├─ types.ts          # public types + DEFAULT_WEIGHTS
│     │  ├─ rng.ts            # seeded PRNG (mulberry32) for reproducibility
│     │  ├─ engine.ts         # buildProblem / feasibility / construct / localSearch / solve
│     │  ├─ demo.ts           # the friend's real case (validation + in-app demo)
│     │  ├─ worker.ts         # Web Worker entrypoint
│     │  ├─ useSolver.ts      # React hook: solve in a worker, Promise-based
│     │  └─ index.ts
│     ├─ export/xlsx.ts       # ExcelJS workbook (schedule + fairness + summary)
│     └─ supabase/            # browser + server Supabase clients
```

## The scheduling problem

Inputs: people, rooms (each with a per-shift **capacity**), shift definitions (time blocks),
the duty dates, availability/days-off, and relationship rules. The engine expands these into:

- **Instances** = each `(duty date × shift)`.
- **Slots** = each `(instance × room × capacity)` — the atomic thing a person fills.

A schedule is an assignment `slot → person`, stored as a flat `Int32Array` for speed.

### Hard constraints (kept feasible *by construction*)

The move generator never creates a state that violates these, so any output is usable:

- **Capacity** — every room/shift filled to exactly its capacity.
- **Availability** — nobody is placed on a date/shift they're unavailable for.
- **Rest / no-24h** — minimum rest between a person's consecutive shifts (single source of
  truth: `projects.rest_hours_min`), plus max-duties-per-day. 24h coverage is achieved by
  *rotating* people across shifts, never by one 24h stint.
- **Never-alone** — a forbidden pair is never the only two people in a room.
- **Hard avoid** — an `is_hard` avoid pair never shares a room.

Phase 0 checks feasibility *before* solving and explains impossibilities in plain language
(e.g. *"this day needs 9 people but only 8 can legally work it"*).

### Soft objective (what the optimiser minimises)

`cost = Σ wᵢ · fᵢ` over weighted penalty terms (defaults in `DEFAULT_WEIGHTS`):

| Term | What it does | Default weight |
| --- | --- | --- |
| `expMax` | crushes the **worst-case** difficult-colleague exposure | 120 |
| `expVar` | spreads difficult-colleague exposure **evenly** (variance) | 120 |
| `room` | equal time in each room per person | 100 |
| `load` | equal total number of duties | 80 |
| `night` | equal share of night/undesirable shifts | 30 |
| `avoid` | penalty per shift an avoid-pair shares a room | 40 |
| `want` | reward per shift a want-pair shares a room | 20 |
| `twoRoom` | penalty for an undesirable 2-person room | 10 |
| `spacing` | penalty for duties on consecutive calendar days | 8 |

The **variance + max** pair on difficult-colleague exposure is the crux fix: variance alone
can hide a single outlier (the "stuck 10 days" person), so an explicit max term attacks the
worst case directly. Exposure is counted by **actual roommates** (capacity-aware), not raw
shift count.

### Algorithm

`solve()` = multi-restart of: **greedy construct → simulated annealing**. The evaluator is
single-pass and allocation-free in the hot loop; the friend's real case (189 slots) solves
in ~2.5s with 4 restarts. Deterministic per seed.

## Data model & privacy

Every table carries an `owner_id` defaulting to `auth.uid()`, **forced** by a trigger so a
client can't forge ownership. Row-Level Security gives each table four policies
(select/insert/update/delete), all keyed on `owner_id = auth.uid()`. Additional triggers
assert that child rows reference a project the caller owns, and that an `assignment`'s
schedule/person/room/shift all belong to the **same project** (prevents intra-account data
corruption). The app is intentionally **not collaborative** — no sharing, no roles.

The heavy solve runs client-side; results are written back as one `schedules` row plus its
`assignments`, all under the user's JWT so RLS still applies. No service-role key in the
browser.

## Design-review trade-offs (decisions on record)

- **Heuristic over exact (ILP/MILP).** A WASM solver could prove optimality but bloats the
  bundle, complicates deploys, and can hang the tab. Simulated annealing always returns a
  good, feasible, explainable roster fast — the right call for a side project. A small
  single-week "prove optimal" mode is a possible future add-on, deliberately off the default
  path.
- **Soft fairness, hard safety.** Keeping fairness soft guarantees a feasible schedule always
  exists; only capacity/availability/rest/never-alone are hard.
- **9 = 9 has no slack.** In the exact case (people = slots), any unavailability makes a day
  impossible. The engine reports this rather than silently dropping coverage. Days-off shine
  when the pool is larger than daily slots.
- **Reproducibility.** Iteration-bounded (not wall-clock-bounded) search + stored seed +
  params snapshot means a run can be reproduced.

## Roadmap (engine & schema already support these)

1. Auth pages (Supabase email/magic-link) + middleware session refresh.
2. Project CRUD: editors for people, rooms, shifts, availability, and pairing rules.
3. Persisting generated schedules; keep/compare/pin multiple runs; lock manual edits.
4. Full styled Excel fairness sheets (RAG status, data bars) and an in-app fairness dashboard.
5. Weight sliders for power users.
