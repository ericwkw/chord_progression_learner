# ChordLab — Fix & Test Plan

## Current state

- `npm install` then `npx vite build` → **passes** (deps were simply not installed).
- `npx tsc --noEmit` → **passes** (0 type errors).
- No test infrastructure exists.
- All logic (audio engine, music-theory engine, components) lives in one 1099-line `index.tsx`.
- The real defects are runtime / music-theory correctness bugs, plus missing dev-env docs.

---

## Phase 0 — Baseline (do first)

1. Commit a working `package-lock.json` (currently absent) so installs are reproducible.
2. Add `.env.example` with `GEMINI_API_KEY=` and a README note. Without it the AI panel fails silently with only a generic "music brain offline" message.
3. Add npm scripts: `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`, `"test:watch": "vitest"`.

---

## Phase 1 — Refactor for testability

The theory engine is pure and deterministic but un-importable because `index.tsx` calls `createRoot(...)` at module load.

1. Create `src/engine/` and move out, unchanged behavior:
   - `theory.ts` — `ALL_NOTES`, `SCALE_PATTERNS`, `getQualityFromIntervals`, `generateKeyChords`, `getNoteAtFret`, `createVoicingFromShape`, `createInversionVoicing`, shape/inversion tables, `Chord`/`Voicing` types.
   - `audio.ts` — `NOTE_FREQUENCIES`, `getFrequency`, `initAudio`, `strumChord`.
2. `index.tsx` imports from `src/engine/*` and keeps only React components + render bootstrap.
3. Guard the bootstrap: keep `const el = document.getElementById('root'); if (el) createRoot(el).render(...)` (already guarded — keep it, tests rely on it).
4. Run `tsc --noEmit` + `vite build` — must still pass, no behavior change yet.

---

## Phase 2 — Fix confirmed bugs

**Status: landed in PR3.** 2.1 (dead-code delete), 2.3, 2.4, 2.5, 2.6, 2.7, 2.8 all done with tests. 2.2 folded into the 2.4 fix (`createInversionVoicing` now retries an octave up).

### 2.1 `createVoicingFromShape` octave-fold — NOT A BUG (dead code)
`src/engine/theory.ts` `createVoicingFromShape`. The `if (finalFret > 12 && shape[0] !== -1 && (shape[0] + rootFret) > 12)` branch can never run: every `eShape` in `CHORD_SHAPES` has `shape[0]` of `0` or `-1`, so `shape[0] + rootFret > 12` requires `rootFret > 12`, and `rootFret` is `% 12`. PR2 tests confirmed high-root voicings (A#, B) are already contiguous.
**Action:** delete the dead branch for clarity; no behavior change. (Covered by the existing voicing-integrity test.)

### 2.2 First-inversion (E-string) dropped when the 3rd is at the nut — LOW
`createInversionVoicing` returns `null` on any negative fret. For the key of C the `Maj_3_E` shape `[0,-1,-2,0,1,-1]` at bass-fret 0 goes negative and is skipped. C major **still** gets `/E` (via the A-string shape) and `/G`, so slash chords aren't lost — only the low-E-string first inversion is missing in keys where the 3rd lands on frets 0–1.
**Fix:** when the computed bass fret is 0–1, use the octave-up position (`+12`) before applying offsets; return `null` only if still invalid. Test: `2.4` in `theory.test.ts` (currently `.fails`).

### 2.3 `baseFret` swallows legit fret 0 — MEDIUM
`Math.min(...frets.filter(f => f !== -1)) || 1` (`index.tsx:315`, :326, :342, :354, :368, :434). An open-position voicing whose lowest note is fret 0 gets `baseFret = 1`. Combined with `Fretboard` `startFret = voicing.baseFret || 1`, open shapes render shifted.
**Fix:** use `const lo = Math.min(...playable); baseFret = Number.isFinite(lo) ? lo : 1;` and let `0` mean "nut". Verify `Fretboard` rendering handles `startFret === 0`.

### 2.4 `Math.min()` on all-muted voicing → `Infinity` — LOW
Same lines as 2.3, plus wildcard `index.tsx:434`. Guard with the `Number.isFinite` check above.

### 2.5 Mutation in `changeVoicing` — MEDIUM
`index.tsx:733`. `newProg = [...progression]` is shallow, then `newProg[idx].activeVoicingIdx = ...` mutates the shared chord object (also referenced by `selectedChord` and, pre-clone, by the palette memo).
**Fix:** `newProg[idx] = { ...newProg[idx], activeVoicingIdx: newVoicingIdx }` then set state from that.

### 2.6 Duplicate React key on rapid add — LOW
`addChord` (`index.tsx:711`) id = `${template.id}-${Date.now()}`; two adds in the same millisecond collide.
**Fix:** module-level incrementing counter, or `crypto.randomUUID()`.

### 2.7 Diminished triad has no roman-numeral marker — LOW
`index.tsx:288-293` adds `°7` only for `dim7`, so a plain `dim` triad (e.g. vii in major, i in Locrian) shows as bare `vii` / `i`.
**Fix:** append `°` when `quality === 'dim'`.

### 2.8 `getFrequency` returns 0 for unknown note → silent dead oscillator — LOW
`index.tsx:17`. Playback path uses `getNoteAtFret` so wildcards' `'?'` notes never reach it today, but it's a latent trap.
**Fix:** early-return without creating the oscillator when freq is 0.

---

## Phase 3 — Test suite (Vitest)

Vite 6 is already a dep; add `vitest` + `@testing-library/react` + `jsdom` as devDeps. `vitest.config.ts` with `environment: 'jsdom'`.

### 3.1 Engine unit tests — `src/engine/theory.test.ts`
- `generateKeyChords('C','Major','Pop')`: I–vii names = C, Dm, Em, F, G, Am, B**dim**; romans I ii iii IV V vi vii°.
- `generateKeyChords('C','Major','Jazz')`: sevenths — Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7b5.
- `generateKeyChords('A','Natural Minor','Pop')`: Am, Bdim, C, Dm, Em, F, G.
- `generateKeyChords('C','Major','Blues')`: I/IV/V are dominant 7ths (C7, F7, G7).
- Every generated voicing: 6 entries, each `-1` or `0..~15`, no negative-non-`-1`, no `NaN`/`Infinity` in `frets` or `baseFret` — loop all 12 roots × all 9 scales × 3 styles.
- `getNoteAtFret`: open strings → E2 A2 D3 G3 B3 E4; E-string fret 12 → E3; octave rollover at C not at the open note.
- `baseFret` is always a finite number ≥ 0 across all keys/scales/styles (done — voicing-integrity test).
- Slash chords: C major yields `/E` and `/G`; A minor yields `/C` (done).
- `.fails` regression specs for 2.3 (open baseFret === 0), 2.4 (E-string first inversion in key of C), 2.7 (° roman marker) — flip to passing in PR3.
- `getQualityFromIntervals`: the six seventh cases + three triad fallbacks.

### 3.2 Audio tests — `src/engine/audio.test.ts`
- Stub `window.AudioContext` with a spy factory. Assert `strumChord` creates one oscillator+gain per note, connects to destination, staggers `start` times by ~0.035 s, and skips notes whose frequency is 0 (after 2.8).
- `getFrequency('A', 4) ≈ 440` (within 0.5 Hz); unknown note → 0.

### 3.3 Component smoke tests — `src/App.test.tsx`
- Renders without throwing; guide modal visible on first mount, dismissable.
- Click a diatonic chord button → chip appears in Progression; `Fretboard` leaves the empty state.
- Add 2 chords → transition badge renders; AI panel appears (button disabled state while loading — mock `@google/genai`).
- Change root/scale/style → progression clears (current behavior) and palette updates.
- Voicing next/prev cycles and wraps.

### 3.4 CI
Add `.github/workflows/ci.yml`: `npm ci` → `npm run typecheck` → `npm run test` → `npm run build`, on push + PR.

---

## Phase 4 — Nice-to-have (separate PRs, not blocking)

- Code-split: dynamic-`import()` the `@google/genai` SDK so it's not in the main 520 kB bundle (only loaded when "Analyze" is clicked).
- `ErrorBoundary` around `<App/>` so an engine throw shows a message, not a white screen.
- Move Tailwind off the CDN `<script>` to a real build dependency for production.
- Consider persisting a progression to `localStorage` / URL hash.

---

## Suggested PR sequence

1. **PR1**: Phase 0 + Phase 1 (env docs, scripts, refactor — zero behavior change, build+tsc green).
2. **PR2**: Phase 3.1–3.2 engine + audio tests against current behavior (lock in what's correct; mark known-bad cases `.fails`).
3. **PR3**: Phase 2 bug fixes, flip the `.fails` tests to passing.
4. **PR4**: Phase 3.3 component tests + Phase 3.4 CI.
5. **PR5+**: Phase 4 items individually.

## Verification gate for every PR

```bash
npm run typecheck && npm run test && npm run build
```
