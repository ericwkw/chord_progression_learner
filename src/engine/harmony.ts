// --- TRANSITION ANALYSIS ---
// Names the harmonic event between two adjacent chords in a progression:
// cadences, root-motion patterns, borrowing, tonicisation, colour changes.

import type { Chord } from './theory';

export type TransitionType = 'resolution' | 'tension' | 'adventure' | 'motion' | 'neutral';

export interface Transition {
  type: TransitionType;
  label: string;
  /** One-line explanation, shown on hover / in the analysis panel. */
  detail: string;
}

const mod12 = (n: number) => ((n % 12) + 12) % 12;

const ROMAN_DEGREE: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7,
};

/** Scale degree (1..7) from a roman numeral, tolerating decoration. */
export const romanDegree = (roman: string): number | null => {
  const m = roman.match(/^[b#♭♯]*([ivIV]+)/);
  return m ? ROMAN_DEGREE[m[1].toLowerCase()] ?? null : null;
};

const isTriad = (q: string) => q === '' || q === 'm';
const isDominantish = (c: Chord) => c.quality === '7' || c.quality === '7#5' || c.quality === '7b5';
const isSuspension = (q: string) => q.startsWith('sus') || q === '7sus4';

export const analyzeTransition = (prev: Chord, curr: Chord): Transition => {
  const pDeg = romanDegree(prev.roman);
  const cDeg = romanDegree(curr.roman);
  const motion = mod12(curr.rootPc - prev.rootPc); // 5 = down a fifth, 7 = up a fifth, 2/10 = step…
  const sameRoot = prev.rootPc === curr.rootPc;

  // Secondary dominant landing on the chord it tonicises.
  if (
    prev.category === 'Secondary' &&
    prev.resolvesTo &&
    romanDegree(curr.roman) === romanDegree(prev.resolvesTo)
  ) {
    return { type: 'resolution', label: 'Tonicize', detail: `${prev.name} is the "V7 of" ${curr.name} — it borrows tension to spotlight it.` };
  }

  // Suspension resolving down to its triad on the same root.
  if (sameRoot && isSuspension(prev.quality) && isTriad(curr.quality)) {
    return { type: 'resolution', label: 'Suspension', detail: 'The suspended note settles back onto a chord tone.' };
  }

  // Cadences (need both degrees).
  if (pDeg === 5 && cDeg === 1) {
    return { type: 'resolution', label: 'Authentic', detail: 'V → I: the strongest resolution, a full stop.' };
  }
  if (pDeg === 5 && cDeg === 6) {
    return { type: 'adventure', label: 'Deceptive', detail: 'V → vi: the dominant resolves somewhere unexpected.' };
  }
  if (pDeg === 4 && cDeg === 1) {
    return { type: 'resolution', label: 'Plagal', detail: 'IV → I: the "amen" cadence, gentler than V → I.' };
  }
  if (cDeg === 5 && (pDeg === 1 || pDeg === 2 || pDeg === 4 || pDeg === 6)) {
    return { type: 'tension', label: 'Half', detail: 'Half cadence — landing on V, an open question that wants an answer.' };
  }

  // Borrowed / modal-interchange chord entering or leaving.
  if (curr.category === 'Wildcard') {
    return { type: 'adventure', label: 'Borrow', detail: `${curr.name} is borrowed from a parallel key for colour.` };
  }
  if (prev.category === 'Wildcard' && curr.isDiatonic) {
    return { type: 'motion', label: 'Return', detail: 'Back to a chord that belongs to the key.' };
  }

  // Chromatic mediant: same triad quality, roots a third apart, one side chromatic.
  if (
    isTriad(prev.quality) && prev.quality === curr.quality &&
    [3, 4, 8, 9].includes(motion) &&
    (!prev.isDiatonic || !curr.isDiatonic)
  ) {
    return { type: 'adventure', label: 'Mediant', detail: 'Chromatic mediant — roots a third apart, sharing one note, a cinematic shift.' };
  }

  // Root-motion patterns.
  if (motion === 5) {
    return { type: 'motion', label: 'Circle 5th', detail: 'Root falls a fifth — the most natural forward pull in tonal harmony.' };
  }
  if (motion === 2 || motion === 10) {
    return { type: 'motion', label: 'Step', detail: 'Roots a whole step apart — smooth, song-like motion.' };
  }
  if (motion === 1 || motion === 11) {
    return { type: 'motion', label: 'Semitone', detail: 'Roots a semitone apart — tense, chromatic voice-leading.' };
  }

  // Same root, quality change (C → Cmaj7, C → Csus2…).
  if (sameRoot) {
    return { type: 'neutral', label: 'Recolour', detail: 'Same root, new chord quality — a change of shade, not direction.' };
  }

  // Fall back to broad functional roles.
  if (prev.function === 'Tension' && curr.function === 'Home') {
    return { type: 'resolution', label: 'Resolve', detail: 'Tension gives way to a resting chord.' };
  }
  if (prev.function === 'Home' && curr.function === 'Tension') {
    return { type: 'tension', label: 'Build', detail: 'Leaving home for a chord that wants to move.' };
  }
  if (curr.function === 'Tension') {
    return { type: 'tension', label: 'Push', detail: 'Into a dominant-function chord.' };
  }

  return { type: 'neutral', label: 'Flow', detail: 'A neutral connecting move.' };
};
