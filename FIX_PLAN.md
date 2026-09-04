# ChordLab — Fix & Test Plan

**Status: complete.** Phases 0–4 landed across PRs #1–#9; PRs #10–#15
followed up on music-theory accuracy, depth and portability (September 2026). All 105 tests
pass; `typecheck` and `build` are clean; CI runs on every PR. The one
deliberately deferred item is URL-hash progression sharing (a separate
feature, not a fix).

| PR | Phase | Summary |
| --- | --- | --- |
| #1 | 0 + 1 | Env docs, `package-lock.json`, `typecheck` script; extracted `src/engine/{theory,audio}.ts` from the 1099-line `index.tsx` (zero behavior change) |
| #2 | 3.1–3.2 | Vitest suite for the engine + audio; known bugs pinned as `it.fails` |
| #3 | — | Dependabot: vitest 2 → 5 |
| #4 | 2 | Bug fixes 2.1–2.8; `.fails` specs flipped to passing |
| #5 | 3.3–3.4 | App smoke tests; `.github/workflows/ci.yml` |
| #6 | 4 | Code-split the Gemini SDK out of the entry chunk |
| #7 | 4 | `ErrorBoundary` around `<App/>`; added missing `@types/react` |
| #8 | 4 | Tailwind CDN → build-time v4 via `@tailwindcss/vite` |
| #9 | 4 | Persist the working progression to `localStorage` |
| #10 | 5 | Key-aware enharmonic note spelling (F major → B♭, flat keys reachable) |
| #11 | 5 | Recognise augmented / altered chord qualities (harmonic & melodic minor) |
| #12 | 5 | Generate secondary dominants (V7/ii, V7/V, …) in the Jazz style |
| #13 | 6 | Real transition analysis — cadences, root motion, borrowing (`src/engine/harmony.ts`) |
| #14 | 6 | CAGED voicings — C/G/D shapes for triads, not just E/A barre |
| #15 | 7 | AI Analyst → provider-agnostic OpenAI-compatible endpoint (OpenRouter default); drop the `@google/genai` SDK |

## Verification gate (run for every change)

```bash
npm run typecheck && npm run test && npm run build
```

---

## Starting state (for the record)

- `npm install` then `npx vite build` passed — deps were simply not installed.
- `npx tsc --noEmit` passed (0 type errors).
- No test infrastructure.
- All logic (audio engine, theory engine, components) in one 1099-line `index.tsx`.
- The real defects were runtime / music-theory correctness bugs plus missing dev-env docs.

---

## Phase 0 — Baseline — DONE (PR #1)

1. Committed `package-lock.json` for reproducible installs.
2. Added `.env.example` (`GEMINI_API_KEY=`) and a real README setup section. Without a key the AI panel degrades to the generic "music brain offline" message.
3. Added npm scripts: `typecheck`, `test`, `test:watch`.

---

## Phase 1 — Refactor for testability — DONE (PR #1)

The theory engine is pure and deterministic but was un-importable because `index.tsx` calls `createRoot(...)` at module load.

1. `src/engine/theory.ts` — `ALL_NOTES`, `SCALE_PATTERNS`, `MUSIC_STYLES`, `generateKeyChords`, `getNoteAtFret`, voicing/inversion helpers, shape/inversion tables, `Chord`/`Voicing` types.
2. `src/engine/audio.ts` — `NOTE_FREQUENCIES`, `getFrequency`, `initAudio`, `strumChord` (AudioContext resolved lazily so the module imports in a non-browser).
3. `index.tsx` imports from `src/engine/*` and keeps only React components + the `#root`-guarded render bootstrap (tests rely on that guard).
4. `tsc --noEmit` + `vite build` stayed green; the production bundle hash was byte-identical after the move.

---

## Phase 2 — Confirmed bug fixes — DONE (PR #4)

Every fix shipped with a regression test.

### 2.1 `createVoicingFromShape` octave-fold — NOT A BUG (dead code, removed)
The `if (finalFret > 12 && shape[0] !== -1 && (shape[0] + rootFret) > 12)` branch could never run — every `eShape` in `CHORD_SHAPES` has `shape[0]` of `0` or `-1`, so the condition needs `rootFret > 12` and `rootFret` is `% 12`. PR2 tests confirmed high-root voicings (A#, B) were already contiguous. The dead branch was deleted; no behavior change.

### 2.2 First-inversion dropped near the nut — folded into 2.4
`createInversionVoicing` returned `null` on any negative fret, so in the key of C the low-E-string first inversion was skipped (C major still got `/E` via the A-string shape and `/G`, so no slash chords were actually lost). Fixed together with 2.4.

### 2.3 `baseFret` swallowed a legit fret 0 — FIXED
`Math.min(...frets.filter(f => f !== -1)) || 1` turned an open position (lowest fret `0`) into `1`. Replaced with a `lowestFret()` helper that returns `0` for the nut and `1` only when every string is muted; `Fretboard` now uses `?? 1`.

### 2.4 First-inversion voicing near the nut / `Math.min()` → `Infinity` — FIXED
`createInversionVoicing` retries the shape an octave up (`+12`) when the raw offsets dip below the nut, returning `null` only if still invalid (capped at fret 15). `lowestFret()`'s `Number.isFinite` guard covers the all-muted case.

### 2.5 Mutation in `changeVoicing` — FIXED
Was `newProg = [...progression]` (shallow) then mutating `newProg[idx].activeVoicingIdx`. Now maps to a new array with a shallow-copied, updated entry; state is set from that.

### 2.6 Duplicate React key on rapid add — FIXED
Progression chord ids used `${template.id}-${Date.now()}`. Now a module-level monotonic counter (`nextChordSeq`).

### 2.7 Diminished triad had no roman-numeral marker — FIXED
Appends `°` when `quality === 'dim'` (half-diminished `m7b5` keeps `ø`).

### 2.8 `getFrequency` returning 0 → silent dead oscillator — FIXED
`strumChord` skips a note whose frequency can't be resolved instead of starting a muted oscillator.

---

## Phase 3 — Test suite (Vitest) — DONE (PRs #2, #5)

`vitest` (v5 after PR #3) + `@testing-library/react` + `@testing-library/user-event` + `jsdom`; `vitest.config.ts` (jsdom env), `src/test/setup.ts`.

### 3.1 Engine unit tests — `src/engine/theory.test.ts`
- Diatonic triads for C major, A natural minor, G major.
- Jazz seventh-chord harmonization for C major (names + `quality` tags).
- Blues dominant cycle (I / IV / V become dominant 7ths).
- Functional-harmony roles.
- `getNoteAtFret`: standard-tuning open strings, 12th-fret octave, octave rollover at C.
- Slash-chord presence (C major → `/E`, `/G`; A minor → `/C`).
- Brute-force voicing-integrity sweep over all 12 roots × 9 scales × 3 styles: 6 frets each, finite and in `-1..20`, finite `baseFret >= 0`.
- Regression specs for 2.3, 2.4, 2.7 (were `it.fails` in PR2, flipped to passing in PR4).

### 3.2 Audio tests — `src/engine/audio.test.ts`
- Fake `AudioContext`: one oscillator+gain per note, wired to the destination, `triangle` wave, ~0.035 s strum stagger, frequency from the note, unresolvable note → no oscillator.
- `getFrequency`: A4 ≈ 440 Hz, C0 ≈ 16.35 Hz with octave doubling, unknown note → 0.

### 3.3 Component smoke tests — `src/App.test.tsx`
- Renders; guide modal shows on first mount and dismisses.
- Adding a chord: fretboard leaves its empty state, the voicing control appears.
- Transition badge between two chips.
- AI Analyst panel appears at 2+ chords and renders feedback (`@google/genai` mocked with a class).
- Key change clears the progression.
- Voicing next/prev cycling.
- Persistence: remount restores the progression and skips the guide; Clear wipes storage.

### 3.4 CI — `.github/workflows/ci.yml`
`npm ci` → `npm run typecheck` → `npm run test` → `npm run build`, on push to `main` and every pull request (Node 20, npm cache).

---

## Phase 4 — Hardening / polish — DONE (PRs #6–#9)

- **Code-split the Gemini SDK (PR #6).** Moved the AI call to `src/services/ai.ts`, which pulls in `@google/genai` via a dynamic `import()`. Entry chunk 519 kB → 224 kB (gzip 128 → 70 kB); the SDK loads on demand when "Analyze" is clicked.
- **`ErrorBoundary` (PR #7).** `src/components/ErrorBoundary.tsx` wraps the root render — a throw in render shows a recoverable message with Try again / Reload instead of a white screen. Also added `@types/react` / `@types/react-dom`, which the project was missing (React APIs were silently `any`).
- **Tailwind at build time (PR #8).** Tailwind v4 via `@tailwindcss/vite`; entry stylesheet `src/index.css`; `tw-animate-css` for the `animate-in` utilities. Built CSS ~35 kB (7 kB gzip) vs the ~3 MB CDN JIT runtime — and it works offline. Removed the stale `aistudiocdn` importmap and the `process` polyfill from `index.html`.
- **Progression persistence (PR #9).** `src/services/persistence.ts` stores a compact `{ root, scaleType, style, chords: [{ templateId, activeVoicingIdx }] }` descriptor in `localStorage`; chords are rebuilt from `generateKeyChords()` on load (missing templates skipped, voicing index clamped). All storage access is `try/catch`'d. Also remembers a "seen the guide" flag.

---

## Phase 5 — Music-theory accuracy — DONE (PRs #10–#12)

Follow-ups from a review of how faithfully the engine models theory.

### Enharmonic note spelling (PR #10)
Notes were spelled from a fixed all-sharps chromatic scale, so F major
showed `A#` for `Bb` and flat keys (D♭, G♭…) were unreachable — teaching
wrong note names.

- `src/engine/notes.ts` (new): a note's identity is its **pitch class**
  (`0..11`); the **name** is a key-dependent view. `spellScale(tonic,
  pattern)` assigns one letter A–G per scale degree (F major → `F G A Bb
  C D E`; F♯ major → correct `E#`; C Locrian → all flats). Spellings
  needing 3+ accidentals fall back to a plain sharp/flat name (only
  pathological mode + key combos).
- `theory.ts`: all interval math via `noteToPc`; scale, chord, and
  borrowed-chord roots spelled in key context. `Chord` gains `rootPc`
  for spelling-independent comparison. Root picker offers `ROOT_OPTIONS`
  (`C Db D Eb E F F# G Ab A Bb B`). `getNoteAtFret` returns `{ pc,
  octave }`; `spellNoteInKey` renders a fret label.
- `audio.ts`: `getFrequency(pc, octave)` is equal-tempered from C0, so
  any spelling (`Bb`, `A#`, `Cb`, double accidentals) plays the right
  pitch; `strumChord` takes `{ pc, octave }`.
- persistence bumped to `v2` (v1 chord ids used the old spelling).
- Tests: `src/engine/notes.test.ts` (spelling, accidental budget, a
  one-letter-per-degree invariant over every key × scale); enharmonic
  cases in `theory.test.ts`; `audio.test.ts` moved to the pc API.

### Augmented / altered chord qualities (PR #11)
`getQualityFromIntervals` only knew major/minor/diminished triads and
the common sevenths, so tertian stacks from harmonic and melodic minor
were mislabeled — C harmonic minor's III (E♭ G B) came out as a plain
`Eb` major triad.

- Added detection for `aug` (3rd 4 / 5th 8), `maj7#5`, `7#5`, `7b5`.
- New `aug` chord shape (open Eaug / Aaug); `maj7#5` / `7#5` borrow it,
  `7b5` borrows the dom-7 shape.
- Fixed the shape-key fallback order — `maj7#5` / `7#5` were caught by
  `q.startsWith('m')` and voiced as minor triads.
- Roman-numeral decoration rewritten as one if/else chain (`III+`,
  `III+Maj7`, `V+7`, `#iv7♭5`); also removed two latent
  double-decoration bugs (`dim7` → `vii7°7`; the generic `7` suffix
  stacking on `maj7` / `ø`).
- Tests: C harmonic minor (Pop triads + Jazz 7ths), C melodic minor, a
  pitch-class check that augmented voicings really spell root/+4/+8, and
  the ø / °7 roman regressions.

### Secondary dominants (PR #12)
The README promised the Jazz style "generates secondary dominants" — it
didn't; the only non-diatonic chords were modal-interchange borrowings.

- New `Secondary` chord category. For the Jazz style, `generateKeyChords`
  emits a dominant-7 chord a perfect fifth above every **major or minor**
  diatonic degree (skipping the tonic and any diminished/augmented
  degree), labelled `V7/ii`, `V7/V`, … with a `resolvesTo` field.
- `index.tsx`: a "Secondary Dominants" palette section (rose, shown only
  when non-empty); `getTransitionInfo` shows a **"Tonicize"** badge when
  a secondary dominant is followed by the chord it targets; guide-modal
  copy updated.
- Tests: Jazz-only gating, the five V7/x for C major and A minor, "a
  fifth above the target" pitch check (`V7/V` = D7 = D F# A C), playable
  voicings, plus an App test for the section appearing on Jazz.

### Still not modeled
- `dimMaj7` (diminished triad + major 7th) — doesn't arise in the nine
  scales' tonic-stacked harmony.
- The renamed function labels ("Home / Adventure / Tension / Stranger /
  Spice") and the crude scale-degree → function mapping are unchanged;
  they are a deliberate simplification, not a bug.

---

## Phase 6 — README claims that were oversold — DONE (PRs #13–#14)

A review of the README against the code flagged three soft spots.

### Transition analysis (PR #13)
The README said transition analysis "detects resolution, tension, and
modal interchange", but `getTransitionInfo` was a five-case lookup on
functional-role pairs living inside `index.tsx`.

- New `src/engine/harmony.ts` — pure `analyzeTransition(prev, curr)`
  returning `{ type, label, detail }`. Detects: secondary-dominant
  tonicisation, suspension resolution, the four cadence types
  (authentic / plagal / deceptive / half), chromatic mediant,
  circle-of-fifths / whole-step / semitone root motion, modal-interchange
  borrowing (enter and leave), and same-root recolouring, before falling
  back to the functional-role heuristic.
- Each result carries a one-line `detail` string, shown as the badge's
  `title` (hover) in the progression timeline. New `motion` transition
  type (sky-blue badge).
- `index.tsx` drops its local `Transition` type + `getTransitionInfo`
  and imports from the engine.
- `src/engine/harmony.test.ts` — the cadences, root-motion patterns,
  borrowing, tonicisation, suspension and recolour cases, plus a sweep
  asserting every pair yields a non-empty `detail`.

### CAGED voicings (PR #14)
The voicing engine emitted only the E-shape and A-shape barre chords —
2 of the 5 CAGED shapes — yet the README said "CAGED system logic".

- `CAGED_SHAPES` table + `movableVoicing()` helper: for a plain major or
  minor triad, also emit the **C, G and D** shapes (and **Dm**), each as
  per-string offsets from the root's fret on its home string. A position
  is skipped for a given root when it would need a fret below the nut,
  past fret 15, or a span over 5 frets.
- C major now cycles E-shape → A-shape → **C Shape** (the open-C grip) →
  **G Shape** → **D Shape** → inversions.
- 7th chords and extensions keep the E/A barre forms only.
- `theory.test.ts`: the five shapes are present for a major triad; the
  C-shape for C is literally `x 3 2 0 1 0`; and a sweep over every key ×
  {major, minor} asserting each CAGED voicing spells the same triad as
  the barre chord, on ≥ 4 strings, within `[0, 15]`.
- README + guide-modal copy updated; the README's inversions line now
  says "for triads" rather than implying 7th-chord inversions.

### Still a limitation (documented, not a bug)
- Inversions / slash chords are generated for plain major/minor triads
  only. Drop-2 / drop-3 inversions for 7th chords would be a real
  jazz-voicing feature, not a small fix; the README no longer implies
  they exist.

---

## Phase 7 — AI provider portability — DONE (PR #15)

The AI Analyst was hard-wired to Google's `@google/genai` SDK and a
`GEMINI_API_KEY`. Switched it to the same provider-agnostic setup the
sibling *Drum Sequencer* project uses.

- `src/services/ai.ts` calls any **OpenAI-compatible `/chat/completions`
  endpoint** with `fetch` — no SDK. Config-driven: `LLM_BASE_URL` /
  `LLM_MODEL` / `API_KEY` env vars, defaulting to **OpenRouter + a free
  model** so a free key works out of the box. Reasoning-model answers
  are read from `content` or `reasoning`.
- `IS_OPENROUTER` is detected from the URL's *hostname* (the copied
  `/(^|\.)openrouter\.ai/` regex never matched `https://openrouter.ai/…`
  because of the leading `//`), so the OpenRouter attribution headers
  are actually sent — and skipped for other providers to avoid a CORS
  preflight rejection.
- `vite.config.ts` `define` maps `API_KEY | OPENROUTER_API_KEY |
  GEMINI_API_KEY | VITE_API_KEY` → `process.env.API_KEY`, plus
  `LLM_BASE_URL` / `LLM_MODEL`. `.env.example` rewritten.
- `@google/genai` removed from `package.json`. The lazy `web-*.js` chunk
  (267 kB) from PR #6 is gone entirely; total JS ~490 kB → ~231 kB.
- `src/services/ai.test.ts` rewritten against a `fetch` stub (endpoint,
  headers, request body, content vs reasoning, HTTP-error, no-key).
  App smoke test stubs `fetch` instead of mocking the SDK.
- `vite.config.ts` `server.port` falls back to `process.env.PORT` so the
  preview server can pick a free port; `.claude/launch.json` gets
  `autoPort`.
- README + Tech Stack updated.

**Verified live** on `chord-progression-learner.vercel.app` with the key
set in Vercel: a Dm → G → C progression returned a correct GLM 5.2
analysis (named the ii–V–I, the pre-dominant/dominant/tonic functions,
and the F→E and B→C voice-leading). Confirms the browser→OpenRouter CORS
path, the free `z-ai/glm-5.2:free` model (checked against OpenRouter's
live model list), and the deployed key wiring. No key locally → the
panel still shows its "music brain offline" fallback.

---

## Deferred (not a fix — its own feature)
- URL-hash progression sharing (a "share this progression" link).
- Drop-2 / drop-3 inversions for 7th chords.
