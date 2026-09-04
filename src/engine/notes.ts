// --- NOTE SPELLING ---
// The engine's internal identity for a note is its pitch class: an integer
// 0..11 where 0 = C. Names ("Bb", "F#", "C##") are a *view* of a pitch class,
// chosen to fit the current key so that a diatonic scale uses each letter
// A..G exactly once (F major → F G A Bb C D E, never F G A A# C D E).

export const PITCH_CLASSES = 12;

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Letter = (typeof LETTERS)[number];

const LETTER_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Pitch class (0..11) of a spelled note name, e.g. "Bb" → 10, "B#" → 0. */
export const noteToPc = (name: string): number => {
  const letter = name[0].toUpperCase() as Letter;
  let pc = LETTER_PC[letter] ?? 0;
  for (const acc of name.slice(1)) pc += acc === '#' ? 1 : acc === 'b' ? -1 : 0;
  return mod12(pc);
};

/**
 * Spell a pitch class using a specific letter. Returns `null` when that letter
 * would need more than `maxAccidentals` sharps or flats (e.g. B### for C in
 * some exotic mode) — callers fall back to a plain spelling.
 */
export const spellWithLetter = (
  pc: number,
  letter: Letter,
  maxAccidentals = 2,
): string | null => {
  let diff = mod12(pc - LETTER_PC[letter]);
  if (diff > 6) diff -= 12; // choose the nearer direction: -6..+6
  if (Math.abs(diff) > maxAccidentals) return null;
  return letter + (diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff));
};

// Plain fallback spellings, sharp side and flat side.
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** A plain single-accidental name for a pitch class. */
export const spellPlain = (pc: number, prefer: 'sharp' | 'flat' = 'sharp'): string =>
  (prefer === 'flat' ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)];

/** True when a key name is on the flat side of the circle of fifths. */
export const isFlatKey = (tonicName: string): boolean =>
  tonicName.includes('b') || tonicName === 'F';

/**
 * Spell a scale as note names, one per letter, starting from the tonic's
 * letter. `pattern` is the scale's semitone offsets from the tonic.
 */
export const spellScale = (tonicName: string, pattern: number[]): string[] => {
  const tonicPc = noteToPc(tonicName);
  const startLetter = LETTERS.indexOf(tonicName[0].toUpperCase() as Letter);
  const prefer = isFlatKey(tonicName) ? 'flat' : 'sharp';
  return pattern.map((semis, i) => {
    const pc = mod12(tonicPc + semis);
    const letter = LETTERS[(startLetter + i) % 7];
    return spellWithLetter(pc, letter) ?? spellPlain(pc, prefer);
  });
};

// Roman-numeral degree (ignoring case and leading accidentals) → 1..7.
const DEGREE: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7,
};

/**
 * Spell a pitch class `pc` to the letter implied by a scale degree (1..7)
 * measured up from the key tonic — used for borrowed chords, e.g. "bVII"
 * in C (degree 7, pc 10) → "Bb".
 */
export const spellDegreeAtPc = (
  tonicName: string,
  degree: number,
  pc: number,
): string => {
  const startLetter = LETTERS.indexOf(tonicName[0].toUpperCase() as Letter);
  const letter = LETTERS[(startLetter + degree - 1) % 7];
  const prefer = isFlatKey(tonicName) ? 'flat' : 'sharp';
  return spellWithLetter(pc, letter) ?? spellPlain(pc, prefer);
};

export const degreeOfRoman = (roman: string): number | undefined => {
  const core = roman.replace(/[b#♭♯]/g, '').toUpperCase();
  return DEGREE[core];
};
