// --- AUDIO ENGINE ---
// Resolved lazily (not at module load) so the module is safe to import in
// non-browser environments such as the test runner.
const getAudioContextClass = (): typeof AudioContext | undefined =>
  typeof window === 'undefined'
    ? undefined
    : (window.AudioContext || (window as any).webkitAudioContext);
let audioCtx: AudioContext | null = null;

// Equal temperament from C0 ≈ 16.351 Hz. `pc` is a pitch class (0 = C .. 11 = B);
// `octave` follows scientific pitch notation (C4 = middle C, octave = 4).
export const C0_HZ = 16.351597831287414;

export const getFrequency = (pc: number, octave: number): number => {
  if (!Number.isFinite(pc)) return 0;
  return C0_HZ * Math.pow(2, pc / 12 + octave);
};

export const initAudio = () => {
    if (!audioCtx) {
        const AudioContextClass = getAudioContextClass();
        if (!AudioContextClass) return;
        audioCtx = new AudioContextClass();
    }
    if (audioCtx?.state === 'suspended') {
        audioCtx.resume();
    }
};

export const strumChord = (notes: { pc: number, octave: number }[]) => {
  initAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  notes.forEach((n, i) => {
    const freq = getFrequency(n.pc, n.octave);
    if (!freq) return; // unresolvable pitch — skip the dead oscillator

    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();

    // Guitar-ish oscillator mix
    osc.type = 'triangle'; // Closer to a plucked string than sine

    osc.frequency.value = freq;

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
