# ChordLab — Fix & Test Plan

**Status: complete.** Phases 0–4 landed across PRs #1–#9 (September 2026). All
51 tests pass; `typecheck` and `build` are clean; CI runs on every PR.
The one deliberately deferred item is URL-hash progression sharing (a
separate feature, not a fix).

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

### Deferred (not a fix — its own feature)
- URL-hash progression sharing (a "share this progression" link).
