# War Room

A draft assistant for a franchise-drafting game. You are dealt one NFL franchise per round and
must decide which roster slot to spend it on. This tool makes that call.

React + Vite, deployed to GitHub Pages.

```bash
npm run dev      # local dev server
npm run build    # production build
```

If Pages serves a blank page, check that `base` in `vite.config.js` matches the repo name.

---

## The game's rules

These are the constraints the engine models. Get them wrong and the recommendations are wrong.

- **Eight slots:** QB, RB, WR1, WR2, TE, Front 7 A, Front 7 B, DB. Front 7 = DL + LB.
- **Round 1** is the player's own chosen franchise. Every later round deals a **random team that
  has not appeared before**. One player per team, so each team is spent on exactly one slot.
- **Three slots are era-locked**, one per era, and **the locks are fixed for the whole board** —
  they are set once at the start and never move. (An earlier version wrongly re-randomized them
  each round; that assumption is dead, don't reintroduce it.)
  - Classic — pre-1995
  - Bridge — 1995 to 2009
  - Modern — 2010 and later
- Scouting a position reveals options but costs points. The tool exists so scouting is unnecessary.
- The game scores the finished roster and reports whether it clears a winning threshold.

---

## Architecture

Currently one file. Splitting the database into its own module is the next planned refactor.

- `TEAMS` — the player database. Keyed by team abbreviation; each holds `name`, `color`, and a
  `p` object of position pools (`QB RB WR TE F7 DB`). Each player is a tuple:
  `[name, firstYearWithTeam, lastYearWithTeam, estimatedRating]`.
- `SLOTS` — the eight roster slots, each mapping to a pool. WR1/WR2 share the WR pool; F7A/F7B
  share F7.
- `ERAS` — era boundaries and display colors.
- `erasFor(start, end)` — which eras a tenure qualifies for.
- `getPool` / `getBest` — the pool with calibration applied. **All engine reads go through these**,
  never through the raw `poolFor` / `bestPlayer`.

---

## The engine

The core idea: the best available player is usually the wrong pick. What matters is **surplus** —
how much better this team is at a slot than a random future team would be.

For each open slot, over the teams still unused:

- `coverage` — fraction that can legally fill it (respecting its era lock)
- `mean` — conditional average rating of those that can

Then for every legal player:

```
score = (rating − mean_for_that_slot) + urgency
urgency = (1 − survival) × 45
survival = 1 − (1 − coverage) ^ roundsRemainingAfterThisPick
```

`urgency` is what makes a scarce locked slot outrank a flashier name elsewhere. Because locks are
fixed, scarcity is knowable from round one — a Classic TE lock may leave only a handful of viable
franchises, and missing them strands the slot.

**Urgency is zero on the final pick.** There is no future round left to lose the slot in. Leaving
it on made every last pick claim a shortage.

### Guard rails learned the hard way

- `top.era` is **null** for unlocked slots. Urgency fires on unlocked slots too, so any message or
  style keyed to `ERAS[era]` must be guarded. This shipped as a crash once.
- Slots with no legal player must degrade gracefully, not throw. Some franchises have no Classic
  era at all (Texans 2002+, Ravens 1996+, Jaguars and Panthers 1995+).

---

## Ratings and calibration

**The ratings in `TEAMS` are estimates, not the game's numbers.** They are modeled on the game's
stated method — career Approximate Value, adjusted across eras, weighted toward peak — on a scale
of roughly 55 to 100. Treat them as a starting prior, nothing more.

Two correction mechanisms, both persisted:

1. **Observed ratings win outright.** Any rating the game displays is stored in `wr:actuals`
   keyed `"team|Player Name"` and used exactly as entered. No estimating for players we've seen.
2. **Least-squares fit.** Once six or more real ratings exist, a linear fit maps estimates onto
   the game's scale and pulls every unseen player along with it. Reported in the UI with an r².

Players the game offers that aren't in `TEAMS` get appended to `wr:extras`.

### Open question: is the scale normalized within position?

The game rates **Travis Kelce at 100**, while an AV-based model puts Tony Gonzalez above him.
That gap suggests the scale may be normalized *per position*, so the best TE ever scores 100 the
same way the best QB does.

This matters enormously. If true, raw ratings are not comparable across slots, and the surplus
engine — which subtracts a slot's mean — is partly compensating for it by accident rather than by
design. The fix would be separate fits per position instead of one global correction.

**How to test it:** log Kelce and Gonzalez side by side. If both sit near 100, TE cannot have two
players at the top of a league-wide scale, and normalization is confirmed. A persistently low r²
as the sample grows is the same signal.

---

## Storage

The app calls `window.storage`, which exists inside Claude but not in a browser. A localStorage
shim provides the same async API locally. Calls are wrapped in try/catch so a missing backend
degrades to a forgetful session rather than a crash.

Keys: `wr:actuals`, `wr:extras`.

---

## Design

Deliberately not a default dashboard. The reference is a physical NFL draft board — magnet strips
on a dark board, era-coded edges, grease-pencil red for the team on the clock.

- Display type: Barlow Condensed 800, uppercase, tight tracking
- Body: IBM Plex Sans · Numbers: IBM Plex Mono, tabular
- Board `#12161C`, panels `#1B222B`, magnet cream `#EDE7DA`
- Classic `#C8912F` · Bridge `#4E9E9A` · Modern `#5C8DEF` · on the clock `#C8342B`

Styling is a plain `<style>` block, not Tailwind. Mobile-first — it gets used on a phone next to
the actual game.

---

## Priorities

1. Extract `TEAMS` into its own module or JSON file.
2. Smoke test that plays a full eight-round board, including an unlocked-slot endgame, so a
   null-era regression fails a check instead of a phone.
3. Expand the database. Thinnest pools are TE league-wide and the pre-1995 tiers of the four
   expansion franchises.
4. Revisit per-position calibration once enough ratings are logged to answer the question above.