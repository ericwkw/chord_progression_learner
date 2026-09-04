// --- AUDIO ENGINE ---
const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
let audioCtx: AudioContext | null = null;

export const NOTE_FREQUENCIES: Record<string, number> = {
  'C': 16.35, 'C#': 17.32, 'Db': 17.32, 'D': 18.35, 'D#': 19.45, 'Eb': 19.45,
  'E': 20.60, 'F': 21.83, 'F#': 23.12, 'Gb': 23.12, 'G': 24.50, 'G#': 25.96,
  'Ab': 25.96, 'A': 27.50, 'A#': 29.14, 'Bb': 29.14, 'B': 30.87
};

export const getFrequency = (note: string, octave: number) => {
  const base = NOTE_FREQUENCIES[note];
  if (!base) return 0;
  return base * Math.pow(2, octave);
};

export const initAudio = () => {
    if (!audioCtx) {
        audioCtx = new AudioContextClass();
    }
    if (audioCtx?.state === 'suspended') {
        audioCtx.resume();
    }
};

export const strumChord = (notes: { note: string, octave: number }[]) => {
  initAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  notes.forEach((n, i) => {
    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();

    // Guitar-ish oscillator mix
    osc.type = 'triangle'; // Closer to a plucked string than sine

    osc.frequency.value = getFrequency(n.note, n.octave);

    // Strumming delay
    const strumDelay = i * 0.035;

    gain.gain.setValueAtTime(0, now + strumDelay);
    gain.gain.linearRampToValueAtTime(0.25, now + strumDelay + 0.05); // Attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + strumDelay + 2.5); // Decay

    osc.connect(gain);
    gain.connect(audioCtx!.destination);

    osc.start(now + strumDelay);
    osc.stop(now + strumDelay + 3.0);
  });
};
