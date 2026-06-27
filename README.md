# doc_scheduler

**Fair duty & room rosters for residents.** · **Asistanlar için adil nöbet & oda çizelgeleri.**

A small, self-hostable web app that builds **fair** hospital duty schedules: it spreads
rooms, undesirable shifts, and "hard-to-work-with" colleagues **equally** across a team,
honours **who-wants-to-work-with-whom** and **who-must-not-be-left-alone-together**, and
exports the result to **Excel**. Bilingual **Türkçe / English**. Deploys to **Vercel** in
minutes; data is **private per user** via Supabase Row-Level Security.

> Built for a resident friend's real problem: 9 people, rooms 1/2/3/3, ~21 duty days, and
> one colleague nobody could schedule fairly. The app solves exactly that — and the general
> case too.

---

## Why it exists

Scheduling these rosters by hand (or with a chatbot) keeps failing on the same things:

1. **Equal time in each room** — everyone should rotate through Green/Yellow/Red evenly.
2. **Pairing preferences** — "I want to be with X more", "don't put me with Y".
3. **Sharing a difficult colleague fairly** — instead of one person being stuck with them
   for 10 days, exposure is spread evenly across the whole team.
4. **Never-alone rule** — two specific people must never be the only two in a room.

…all while covering 24h **without anyone working 24h straight**, respecting **days off**,
and keeping a roughly **1-in-N rhythm**.

doc_scheduler treats this as a fairness-constrained optimisation problem and solves it in
your browser in a couple of seconds.

---

## Features

- 📅 **Calendar-driven & flexible** — pick a date range, define your own shifts/hours, rooms
  & capacities, people, and rules. Nothing is hard-coded to one hospital.
- ⚖️ **Fairness engine** — equal room time, equal difficult-colleague exposure (variance +
  worst-case), equal total load, equal nights/weekends.
- 🤝 **Relationship rules** — *want-together* (soft reward), *avoid-together* (soft or hard),
  *never-alone-together* (hard).
- 🚫 **Hard constraints respected by construction** — room capacity, availability/days-off,
  rest between shifts (no 24h chains), never-alone. The engine never produces a roster that
  breaks these.
- 🧠 **Explainable, not a black box** — a fairness score, per-person room matrix, exposure
  tally, and a plain-language reason when a setup is **impossible**.
- 📊 **Excel export** — multi-sheet `.xlsx` (schedule grid + fairness proof + summary).
- 🌍 **Bilingual TR/EN** with an in-app toggle.
- 🔒 **Private per user** — Supabase Auth + Row-Level Security. Not collaborative; each login
  sees only their own data.
- ⚡ **Runs client-side** in a Web Worker — no server compute, no serverless timeouts, free
  to host.

---

## How it works (the engine)

The solver lives in [`src/lib/scheduler/`](src/lib/scheduler) and is pure TypeScript with no
framework dependencies, so it runs in a Web Worker, in Node, or in tests. Three phases:

1. **Expand & validate** — turn the config into duty *slots* and check feasibility up front
   (e.g. *"July 16: 9 slots need filling but only 8 people are available"*).
2. **Fair greedy construction** — build a hard-feasible starting roster, biased toward
   balance.
3. **Simulated annealing** — swap people between rooms (and in/out from the bench for
   rotations) to drive the fairness objective down, keeping all hard rules intact.

Hard constraints bound the search; everything fairness-related is a **weighted soft penalty**,
so a feasible schedule always exists when Phase 1 passes. Runs are **deterministic for a
given seed** (reproducible), and "Regenerate" reseeds for an equally-fair alternative.

### Try it without installing anything

```bash
npm install
npm run validate   # solves the friend's real case + a rotation case, prints the proof
npm run dev        # open http://localhost:3000 and click "Load demo"
```

`npm run validate` output on the real case: **feasible, fairness 95/100, every person gets
the difficult colleague exactly 4 times (spread = 0), rooms balanced**, solved in ~2.5s.

---

## Quick start (deploy)

You need a free **Supabase** account and a free **Vercel** account.

### 1. Create the Supabase project
- supabase.com → **New project** (region **Frankfurt / eu-central-1** is closest to Turkey).
- **SQL Editor → New query** → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
  This creates every table, enables Row-Level Security, and adds the ownership triggers.
- **Settings → API** → copy the **Project URL** and the **anon / publishable key**.

### 2. Deploy to Vercel
- vercel.com → **Add New → Project** → import the GitHub repo.
- Add two **Environment Variables**:
  | Name | Value |
  | --- | --- |
  | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon / publishable key |
- **Deploy**. Done.

### 3. (Optional) Auth redirect
In Supabase **Authentication → URL Configuration**, set the **Site URL** to your Vercel
domain so magic-link / email confirmation redirects land back on the app.

---

## Local development

```bash
cp .env.example .env.local      # then fill in your Supabase URL + anon key
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run validate` | Run the engine on real fixtures & assert fairness (regression test) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Next.js lint |

### Environment variables

| Name | Required | Public | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | for accounts | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for accounts | yes | anon/publishable key (RLS protects data) |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | no | yes | `tr` or `en` (default `tr`) |

> The **demo runs with no env vars at all** — Supabase is only needed for saving projects
> across sessions/devices.

---

## Tech stack

- **Next.js (App Router) + TypeScript + Tailwind CSS** — one-click Vercel deploys.
- **Supabase** (Postgres + Auth + Row-Level Security) — private per-user storage.
- **Web Worker solver** (pure TS) — client-side, no serverless compute.
- **ExcelJS** — styled `.xlsx` export, generated in the browser.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the data model, the fairness objective, and the
design decisions (including the trade-offs an adversarial design review surfaced).

---

## Türkçe özet

doc_scheduler, asistanlar için **adil nöbet ve oda çizelgeleri** oluşturan küçük bir web
uygulamasıdır. Odaları, gece/hafta sonu nöbetlerini ve **birlikte çalışması zor bir kişiye
denk gelmeyi** ekip içinde **eşit** dağıtır; **kiminle çalışmak istediğini / kimden
kaçındığını** ve **iki kişinin asla bir odada yalnız kalmaması** kuralını dikkate alır. Sonuç
**Excel** olarak indirilir. Arayüz **Türkçe/İngilizce**. **Vercel**'e dakikalar içinde
kurulur; veriler Supabase ile **kullanıcıya özel ve gizlidir**. Demoyu denemek için
`npm install && npm run dev` çalıştırıp **"Demo verisini yükle"** butonuna basın.

---

## Status & roadmap

✅ Scheduling engine (validated), demo UI, Excel export, i18n, DB schema, Vercel-ready build.

Next: full project CRUD UI (people/rooms/shifts/rules editors), Supabase auth pages, saving &
comparing multiple generated schedules, and the full styled fairness report sheets. The
engine and data model already support all of it.

## License

MIT — built for a friend's real rota problem.
