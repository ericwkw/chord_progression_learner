## Support me: https://ko-fi.com/ericwkw

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
    *   **Jazz**: Automatically harmonizes scales into 7th chords (Maj7, m7, m7b5) and generates secondary dominants.
    *   **Blues**: Enforces Dominant 7th cycles (I7, IV7, V7).

### 2. **Dynamic Fretboard Visualization**
*   **Voicing Algorithms**: Automatically finds playable guitar voicings (CAGED system logic) based on the chord's notes.
*   **Inversions & Slash Chords**: Generates First and Second inversions (e.g., C/E, Am/C) to facilitate voice leading.
*   **Interval Mapping**: Visualizes how chord tones map to the scale.

### 3. **Functional Harmony Analysis**
*   **Color-Coded Functions**: Instantly identify Tonic, Subdominant, and Dominant functions.
*   **Transition Analysis**: Detects resolution, tension, and modal interchange between chords in the timeline.
*   **AI Integration**: Uses Google's **Gemini 2.5 Flash** model to provide natural language explanations of your progression's voice leading and emotional character.

### 4. **Browser-Native Audio**
*   **Web Audio API**: Synthesizes guitar tones directly in the browser using oscillators and gain nodes. No external sample libraries required.

---

## 🛠️ Tech Stack

*   **Frontend**: React 19
*   **Styling**: Tailwind CSS (via CDN for portability)
*   **Audio**: Web Audio API (Oscillators/Gain)
*   **AI**: Google GenAI SDK (`@google/genai`)
*   **Icons**: Lucide React

---

## 🤝 Contributing

We welcome contributions from developers and musicians!

### Ideas for Contribution:
1.  **New Voicing Algorithms**: Improve the fretboard logic to support Drop-2 or Drop-3 voicings for Jazz.
2.  **Rhythm Patterns**: Update the `strumChord` function to support different strumming patterns or arpeggios.
3.  **Export**: Add MIDI export functionality for the progression timeline.

### Getting Started
1.  Clone the repo.
2.  Open `index.html` in a browser (or serve via a local server like Vite/Live Server).
3.  Set your `API_KEY` in the environment if you want to test the AI features.

---

*Built for the love of music and code.* 🎵💻
