
# 🎸 ChordLab: Generative Music Theory Assistant

**ChordLab** is an interactive web application designed for guitarists and songwriters to explore functional harmony, chord progressions, and fretboard voicings. 

Unlike static chord charts, ChordLab uses a **generative music theory engine** to algorithmically calculate notes, intervals, and valid guitar voicings for any key and mode.

---

## 🚀 Key Features

### 1. **Generative Theory Engine**
The app does not use hardcoded databases. Instead, it calculates chords in real-time based on music theory rules:
*   **84+ Keys**: Supports 12 roots across 7 modes (Major, Minor, Dorian, Mixolydian, etc.).
*   **Style-Aware Logic**:
    *   **Pop/Folk**: Prioritizes Triads, Sus2, Sus4, and Add9 chords.
    *   **Jazz**: Harmonizes the scale into 7th chords (Maj7, m7, m7b5, dim7, aug-Maj7…) and generates the secondary dominants (V7/ii, V7/V, …) that tonicise each diatonic chord.
    *   **Blues**: Enforces Dominant 7th cycles (I7, IV7, V7).

### 2. **Dynamic Fretboard Visualization**
*   **Voicing Algorithms**: Automatically finds playable guitar voicings (CAGED system logic) based on the chord's notes.
*   **Inversions & Slash Chords**: Generates First and Second inversions (e.g., C/E, Am/C) to facilitate voice leading.
*   **Interval Mapping**: Visualizes how chord tones map to the scale.

### 3. **Functional Harmony Analysis**
*   **Color-Coded Functions**: Instantly identify Tonic, Subdominant, and Dominant functions.
*   **Transition Analysis**: Names the harmonic event between adjacent chords — authentic / plagal / deceptive / half cadences, circle-of-fifths and stepwise root motion, tonicisation by a secondary dominant, and modal-interchange borrowing — each with a one-line explanation.
*   **AI Integration**: Sends your progression to any **OpenAI-compatible chat model** (OpenRouter's free tier by default) for a natural-language explanation of its functional harmony and voice leading.

### 4. **Browser-Native Audio**
*   **Web Audio API**: Synthesizes guitar tones directly in the browser using oscillators and gain nodes. No external sample libraries required.

---

## 🛠️ Tech Stack

*   **Frontend**: React 19
*   **Styling**: Tailwind CSS v4 (compiled at build time via `@tailwindcss/vite`)
*   **Audio**: Web Audio API (Oscillators/Gain)
*   **AI**: any OpenAI-compatible chat API (OpenRouter by default), called with `fetch` — no SDK
*   **Icons**: Lucide React

---

## 🤝 Contributing

We welcome contributions from developers and musicians!

### Ideas for Contribution:
1.  **New Voicing Algorithms**: Improve the fretboard logic to support Drop-2 or Drop-3 voicings for Jazz.
2.  **Rhythm Patterns**: Update the `strumChord` function to support different strumming patterns or arpeggios.
3.  **Export**: Add MIDI export functionality for the progression timeline.

### Getting Started

**Prerequisites:** Node.js 18+

```bash
npm install
cp .env.example .env.local   # optional: add a free API_KEY for the AI Analyst
npm run dev                   # http://localhost:3000
```

Other scripts:

| Command | Purpose |
| --- | --- |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check with `tsc --noEmit` |

The app runs fully without an API key; only the **AI Analyst** panel needs `API_KEY`.
A free [OpenRouter key](https://openrouter.ai/keys) works out of the box; set
`LLM_BASE_URL` / `LLM_MODEL` to use a different provider (e.g. Gemini's
OpenAI-compatible endpoint) with no code change — see `.env.example`.

### Project layout

| Path | Contents |
| --- | --- |
| `index.tsx` | React components + app bootstrap |
| `src/engine/notes.ts` | Note spelling — pitch classes ↔ key-aware enharmonic names (F major → B♭, not A♯) |
| `src/engine/theory.ts` | Pure music-theory engine — scales, chord generation, voicings, inversions, secondary dominants |
| `src/engine/harmony.ts` | Transition analysis — names the cadence / root-motion / borrowing between two chords |
| `src/engine/audio.ts` | Web Audio synthesis — equal-tempered frequencies, strum playback |
| `src/services/ai.ts` | Progression analysis via an OpenAI-compatible chat endpoint (config-driven provider) |
| `src/services/persistence.ts` | localStorage save/restore for the working progression |
| `src/components/ErrorBoundary.tsx` | Top-level render-error fallback |

---

*Built for the love of music and code.* 🎵💻
