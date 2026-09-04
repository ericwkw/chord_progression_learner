// --- MUSIC THEORY ENGINE ---

import {
  LETTERS,
  noteToPc,
  spellWithLetter,
  spellPlain,
  spellScale,
  spellDegreeAtPc,
  degreeOfRoman,
  isFlatKey,
  type Letter,
} from './notes';

// Chromatic pitch classes (sharp spelling). Kept for callers that only need a
// 12-slot index; note *display* names come from the key-aware speller.
export const PITCH_CLASS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Backwards-compatible alias.
export const ALL_NOTES = PITCH_CLASS;

// Keys offered in the root picker: chromatic order, conventional spelling
// (flats on the flat side, F# rather than Gb).
export const ROOT_OPTIONS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const SCALE_PATTERNS: Record<string, number[]> = {
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Natural Minor': [0, 2, 3, 5, 7, 8, 10],
  'Melodic Minor (Jazz)': [0, 2, 3, 5, 7, 9, 11], // Jazz Minor: 1 2 b3 4 5 6 7
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Locrian': [0, 1, 3, 5, 6, 8, 10], // 1 b2 b3 4 b5 b6 b7
  'Phrygian': [0, 1, 3, 5, 7, 8, 10],
  'Lydian': [0, 2, 4, 6, 7, 9, 11],
};

export const MUSIC_STYLES = [
  { id: 'Pop', label: 'Pop / Folk', description: 'Triads & Sus chords' },
  { id: 'Jazz', label: 'Jazz', description: '7ths & Extensions' },
  { id: 'Blues', label: 'Blues', description: 'Dominant Cycles' },
];

const ROMAN_NUMERALS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];

const mod12 = (n: number) => ((n % 12) + 12) % 12;

// Semitone value of a note used as an open guitar string / reference.
const pc = (name: string) => noteToPc(name);

// Offsets from the barre/nut for common shapes
// -1 means mute, numbers are relative fret adds
const CHORD_SHAPES: Record<string, { eShape: number[], aShape: number[] }> = {
    // TRIADS
    '': { // Major
        eShape: [0, 2, 2, 1, 0, 0],
        aShape: [-1, 0, 2, 2, 2, 0]
    },
    'm': { // Minor
        eShape: [0, 2, 2, 0, 0, 0],
        aShape: [-1, 0, 2, 2, 1, 0]
    },
    'dim': { // Diminished Triad
        eShape: [0, 1, 2, 0, -1, -1],
        aShape: [-1, 0, 1, 2, 1, -1]
    },
    'aug': { // Augmented Triad
        // Eaug: 0 3 2 1 1 0
        eShape: [0, 3, 2, 1, 1, 0],
        // Aaug: x 0 3 2 2 1
        aShape: [-1, 0, 3, 2, 2, 1]
    },
    // SUSPENDED & ADD
    'sus4': {
        // Esus4: 0 2 2 2 0 0
        eShape: [0, 2, 2, 2, 0, 0],
        // Asus4: x 0 2 2 3 0
        aShape: [-1, 0, 2, 2, 3, 0]
    },
    'sus2': {
        // Standard Esus2: 0 2 4 4 0 0
        eShape: [0, 2, 4, 4, 0, 0],
        // Asus2: x 0 2 2 0 0
        aShape: [-1, 0, 2, 2, 0, 0]
    },
    'add9': {
        // Eadd9: 0 2 2 1 0 2 (Tricky pinky) or 0 2 4 1 0 0
        eShape: [0, 2, 4, 1, 0, 0],
        // Aadd9: x 0 2 2 2 2 (Barre+pinky) or x 0 2 4 2 0
        aShape: [-1, 0, 2, 4, 2, 0]
    },
    '6': {
        // E6: 0 2 2 1 2 0
        eShape: [0, 2, 2, 1, 2, 0],
        // A6: x 0 2 2 2 2 (F# on top)
        aShape: [-1, 0, 2, 2, 2, 2]
    },
    // 7TH CHORDS
    'maj7': { eShape: [0, 2, 1, 1, 0, 0], aShape: [-1, 0, 2, 1, 2, 0] },
    'm7': { eShape: [0, 2, 0, 0, 0, 0], aShape: [-1, 0, 2, 0, 1, 0] },
    '7': { eShape: [0, 2, 0, 1, 0, 0], aShape: [-1, 0, 2, 0, 2, 0] },
    '7sus4': {
        // E7sus4: 0 2 0 2 0 0
        eShape: [0, 2, 0, 2, 0, 0],
        // A7sus4: x 0 2 0 3 0
        aShape: [-1, 0, 2, 0, 3, 0]
    },
    'm7b5': { eShape: [0, -1, 0, 0, -1, -1], aShape: [-1, 0, 1, 0, 1, -1] },
    'dim7': { eShape: [0, 1, 0, 0, -1, -1], aShape: [-1, 0, 1, 2, 1, -1] }
};

// Inversion Shapes: offsets relative to the Bass Note Fret
const INVERSION_SHAPES: Record<string, number[]> = {
    // MAJOR OVER 3rd (e.g. G/B, C/E)
    // E-Bass: Bass(0), Mute, 5th(-2), Root(0), 3rd(+1), Mute
    'Maj_3_E': [0, -1, -2, 0, 1, -1],
    // A-Bass: Mute, Bass(0), 5th(-2), Root(-2), 3rd(-2), 5th(+1)
    'Maj_3_A': [-1, 0, -2, -2, -2, 1],

    // MINOR OVER 3rd (e.g. Gm/Bb, Am/C)
    // E-Bass: Bass(0), Mute, 5th(-1), Root(+1), b3(+2), Mute
    'Min_3_E': [0, -1, -1, 1, 2, -1],
    // A-Bass: Mute, Bass(0), 5th(-1), Root(-1), b3(-2), Mute
    'Min_3_A': [-1, 0, -1, -1, -2, -1],

    // MAJOR OVER 5th (e.g. A/E, C/G)
    // E-Bass: Bass(0), Root(0), 3rd(+2), 5th(+2), Root(+2), 3rd(0) -- A/E style
    'Maj_5_E': [0, 0, 2, 2, 2, 0],
};

export interface Voicing {
  name: string;
  frets: number[]; // 6 strings, -1 for mute, 0 for open
  baseFret?: number; // For rendering positioning
}

export interface Chord {
  id: string; // Unique ID for key
  root: string;
  rootPc: number; // pitch class of the root (0..11), spelling-independent
  quality: string; // suffix: '' | 'm' | 'dim' | 'aug' | '7' | 'maj7' | 'm7' | 'm7b5' | 'dim7' | 'mMaj7' | 'maj7#5' | '7#5' | '7b5' | 'sus4' | ...
  name: string;
  roman: string;
  function: 'Home' | 'Adventure' | 'Tension' | 'Stranger' | 'Spice'; // Functional harmony role
  notes: string[];
  voicings: Voicing[];
  activeVoicingIdx: number;
  scaleDegree: number;
  isDiatonic: boolean;
  category: 'Team' | 'Variation' | 'Wildcard' | 'Secondary';
  /** For a secondary dominant: the diatonic roman it resolves to (e.g. "ii"). */
  resolvesTo?: string;
}

// Guitar tuning: E2, A2, D3, G3, B3, E4
export const GUITAR_TUNING = [
  { note: 'E', octave: 2 },
  { note: 'A', octave: 2 },
  { note: 'D', octave: 3 },
  { note: 'G', octave: 3 },
  { note: 'B', octave: 3 },
  { note: 'E', octave: 4 },
];

// A fretted note as a pitch class + octave (scientific pitch notation).
// Display spelling is applied separately, in key context.
export const getNoteAtFret = (
  stringIdx: number,
  fret: number,
): { pc: number; octave: number } | null => {
  if (fret === -1) return null;
  const openNote = GUITAR_TUNING[stringIdx];
  const totalSemis = pc(openNote.note) + fret;
  return { pc: mod12(totalSemis), octave: openNote.octave + Math.floor(totalSemis / 12) };
};

// Spell a fretted pitch class for display, preferring a name already present
// in the current scale, then the key's sharp/flat bias (inferred from the
// tonic, i.e. scaleNotes[0]).
export const spellNoteInKey = (pitchClass: number, scaleNotes: string[]): string => {
  const match = scaleNotes.find(n => noteToPc(n) === pitchClass);
  if (match) return match;
  const flat = scaleNotes.length > 0 && isFlatKey(scaleNotes[0]);
  return spellPlain(pitchClass, flat ? 'flat' : 'sharp');
};

// The lowest fretted (non-muted) fret of a voicing, used to position the
// fretboard render. Returns 1 when every string is muted (no finite min).
const lowestFret = (frets: number[]): number => {
    const lo = Math.min(...frets.filter(f => f !== -1));
    return Number.isFinite(lo) ? lo : 1;
};

// Helper to shift a shape to a specific root fret
const createVoicingFromShape = (shape: number[], rootFret: number): number[] => {
    return shape.map(f => (f === -1 ? -1 : f + rootFret));
};

const createInversionVoicing = (shape: number[], bassFret: number): number[] | null => {
    // If the bass note sits at or near the nut the raw shape can dip below
    // fret 0; retry an octave up before giving up.
    for (const bf of [bassFret, bassFret + 12]) {
        const frets = shape.map(f => (f === -1 ? -1 : f + bf));
        if (!frets.some(f => f < 0 && f !== -1) && Math.max(...frets) <= 15) return frets;
    }
    return null;
};

// `third`, `fifth`, `seventh` are semitone intervals above the chord root.
// Returns a quality suffix ('' = major triad); the caller adds the roman
// numeral decoration.
const getQualityFromIntervals = (third: number, fifth: number, seventh: number | null): string => {
    if (seventh !== null) {
      if (third === 4 && fifth === 7 && seventh === 11) return 'maj7';
      if (third === 4 && fifth === 7 && seventh === 10) return '7'; // Dom7
      if (third === 3 && fifth === 7 && seventh === 10) return 'm7';
      if (third === 3 && fifth === 7 && seventh === 11) return 'mMaj7'; // minor-major 7th (harmonic/melodic-minor I)
      if (third === 3 && fifth === 6 && seventh === 10) return 'm7b5'; // half-diminished
      if (third === 3 && fifth === 6 && seventh === 9) return 'dim7';  // fully diminished 7th
      if (third === 4 && fifth === 8 && seventh === 11) return 'maj7#5'; // augmented-major 7th (harmonic/melodic-minor III)
      if (third === 4 && fifth === 8 && seventh === 10) return '7#5';   // augmented dominant
      if (third === 4 && fifth === 6 && seventh === 10) return '7b5';   // dominant flat-5
    }
    // Triad fallback (also used when a stacked 7th matched nothing above).
    if (third === 4 && fifth === 7) return '';
    if (third === 3 && fifth === 7) return 'm';
    if (third === 3 && fifth === 6) return 'dim';
    if (third === 4 && fifth === 8) return 'aug';
    return '';
};

// Generates chords for a specific key and style
export const generateKeyChords = (root: string, scaleType: string, style: string): Chord[] => {
  const rootPc = noteToPc(root);
  const pattern = SCALE_PATTERNS[scaleType];
  const scaleNotes = spellScale(root, pattern);
  const flat = isFlatKey(root);

  // Spell a note `semitones` above `fromName` using a letter `letterSteps`
  // scale-steps higher (e.g. a major third: 2 steps, 4 semitones).
  const spelledInterval = (fromName: string, letterSteps: number, semitones: number): string => {
    const startLetter = LETTERS.indexOf(fromName[0].toUpperCase() as Letter);
    const letter = LETTERS[(startLetter + letterSteps) % 7];
    const target = mod12(noteToPc(fromName) + semitones);
    return spellWithLetter(target, letter) ?? spellPlain(target, flat ? 'flat' : 'sharp');
  };

  const allChords: Chord[] = [];
  // Per-degree triad quality ('' | 'm' | 'dim' | 'aug') and plain roman,
  // captured for the secondary-dominant pass below.
  const triadQuality: string[] = [];
  const baseRoman: string[] = [];

  // 1. DIATONIC TEAM
  scaleNotes.forEach((note, i) => {
    const chordRootPc = noteToPc(note);

    let thirdNote = scaleNotes[(i + 2) % 7];
    let fifthNote = scaleNotes[(i + 4) % 7];
    let seventhNote = scaleNotes[(i + 6) % 7];

    let useSevenths = (style === 'Jazz' || style === 'Blues');

    // Blues Override: force a dominant 7th on I, IV, V.
    if (style === 'Blues' && (i === 0 || i === 3 || i === 4)) {
       thirdNote = spelledInterval(note, 2, 4);  // major 3rd
       seventhNote = spelledInterval(note, 6, 10); // minor 7th
       useSevenths = true;
    }

    const thirdInterval = mod12(noteToPc(thirdNote) - chordRootPc);
    const fifthInterval = mod12(noteToPc(fifthNote) - chordRootPc);
    const seventhInterval = mod12(noteToPc(seventhNote) - chordRootPc);

    let quality = getQualityFromIntervals(thirdInterval, fifthInterval, useSevenths ? seventhInterval : null);

    triadQuality[i] = getQualityFromIntervals(thirdInterval, fifthInterval, null);
    baseRoman[i] = thirdInterval === 4 ? ROMAN_NUMERALS[i].toUpperCase() : ROMAN_NUMERALS[i];

    // Determine Function
    let func: Chord['function'] = 'Adventure';
    if (i === 0) func = 'Home'; // I
    if (i === 4) func = 'Tension'; // V
    if (i === 6) func = 'Tension'; // vii
    if (i === 2 || i === 5) func = 'Home'; // iii, vi
    if (i === 1 || i === 3) func = 'Adventure'; // ii, IV

    if (style === 'Blues' || scaleType === 'Mixolydian') {
       if (i === 0) func = 'Home'; if (i === 3) func = 'Adventure'; if (i === 4) func = 'Tension';
    }

    let roman = ROMAN_NUMERALS[i];
    if (thirdInterval === 4) roman = roman.toUpperCase();
    if (quality === 'maj7') roman += 'Maj7';
    else if (quality === 'mMaj7') roman += 'Maj7'; // minor triad already lower-case
    else if (quality === 'm7b5') roman += 'ø';
    else if (quality === 'dim7') roman += '°7';
    else if (quality === 'dim') roman += '°';
    else if (quality === 'aug') roman += '+';
    else if (quality === 'maj7#5') roman += '+Maj7';
    else if (quality === '7#5') roman += '+7';
    else if (quality === '7b5') roman += '7♭5';
    else if (quality.includes('7')) roman += '7'; // m7, dom 7

    // Build Chord Object
    const buildChord = (q: string, n: string, r: string, f: Chord['function'], cat: Chord['category'], customId: string = '') => {
        const voicings: Voicing[] = [];
        // Pick the closest playable shape for qualities without their own.
        let shapeKey = q;
        if (!CHORD_SHAPES[shapeKey]) {
            if (q === 'maj7#5' || q === '7#5') shapeKey = 'aug';
            else if (q === '7b5') shapeKey = '7';
            else if (q === 'mMaj7') shapeKey = 'm7';
            else if (q.startsWith('m')) shapeKey = 'm';
            else if (q.startsWith('dim')) shapeKey = 'dim';
            else shapeKey = '';
        }
        const shapeTemplate = CHORD_SHAPES[shapeKey] || CHORD_SHAPES[''];
        const nPc = noteToPc(n);

        // E-Shape
        const eShapeRootFret = mod12(nPc - pc('E'));
        const eFrets = createVoicingFromShape(shapeTemplate.eShape, eShapeRootFret);
        const isEBarre = eFrets.some(fr => fr > 0) && eShapeRootFret > 0;
        voicings.push({
            name: !isEBarre ? "Open / Bottom" : `Root on E (Fret ${eShapeRootFret || 12})`,
            frets: eFrets,
            baseFret: lowestFret(eFrets)
        });

        // A-Shape
        const aShapeRootFret = mod12(nPc - pc('A'));
        const aFrets = createVoicingFromShape(shapeTemplate.aShape, aShapeRootFret);
        const isABarre = aFrets.some(fr => fr > 0) && aShapeRootFret > 0;
        voicings.push({
            name: !isABarre ? "Open A-Style" : `Root on A (Fret ${aShapeRootFret || 12})`,
            frets: aFrets,
            baseFret: lowestFret(aFrets)
        });

        // --- INVERSIONS ---
        // 1. First Inversion (Bass = 3rd)
        if (q === '' || q === 'm') {
            const isMinor = q === 'm';
            const thirdNoteName = thirdNote;
            const thirdE_Fret = mod12(noteToPc(thirdNoteName) - pc('E'));
            const shapeNameE = isMinor ? 'Min_3_E' : 'Maj_3_E';
            const invFretsE = createInversionVoicing(INVERSION_SHAPES[shapeNameE], thirdE_Fret);
            if (invFretsE) {
                voicings.push({
                    name: `/${thirdNoteName} (Bass on E)`,
                    frets: invFretsE,
                    baseFret: lowestFret(invFretsE)
                });
            }

            const thirdA_Fret = mod12(noteToPc(thirdNoteName) - pc('A'));
            const shapeNameA = isMinor ? 'Min_3_A' : 'Maj_3_A';
            const invFretsA = createInversionVoicing(INVERSION_SHAPES[shapeNameA], thirdA_Fret);
            if (invFretsA) {
                voicings.push({
                    name: `/${thirdNoteName} (Bass on A)`,
                    frets: invFretsA,
                    baseFret: lowestFret(invFretsA)
                });
            }
        }

        // 2. Second Inversion (Bass = 5th)
        if (q === '') {
             const fifthNoteName = fifthNote;
             const fifthE_Fret = mod12(noteToPc(fifthNoteName) - pc('E'));
             const invFrets5 = createInversionVoicing(INVERSION_SHAPES['Maj_5_E'], fifthE_Fret);
             if (invFrets5) {
                voicings.push({
                    name: `/${fifthNoteName} (Bass on E)`,
                    frets: invFrets5,
                    baseFret: lowestFret(invFrets5)
                });
             }
        }

        const cNotes = [n, thirdNote, fifthNote];

        return {
            id: `${n}${q}-${i}-${customId}`,
            root: n,
            rootPc: nPc,
            quality: q,
            name: `${n}${q}`,
            roman: r,
            function: f,
            notes: cNotes,
            voicings: voicings,
            activeVoicingIdx: 0,
            scaleDegree: i + 1,
            isDiatonic: true,
            category: cat
        };
    };

    allChords.push(buildChord(quality, note, roman, func, 'Team'));

    // 2. VARIATIONS (Spices) — only for major/minor chords, to stay musical.
    if (quality === '' || quality === '7') { // Major Triad or Dom7
        allChords.push(buildChord('sus4', note, roman + 'sus4', 'Spice', 'Variation', 'sus4'));
        allChords.push(buildChord('sus2', note, roman + 'sus2', 'Spice', 'Variation', 'sus2'));
        if (style === 'Pop') {
            allChords.push(buildChord('add9', note, roman + 'add9', 'Spice', 'Variation', 'add9'));
        }
        if (quality === '') { // Plain Major
             allChords.push(buildChord('6', note, roman + '6', 'Spice', 'Variation', '6'));
        }
    }

    if (quality === '7') { // Dom7 specific
        allChords.push(buildChord('7sus4', note, roman + '7sus', 'Tension', 'Variation', '7sus4'));
    }
  });

  // 3. WILDCARDS (Happy Accidents / Borrowed Chords)
  const addWildcard = (degreeOffset: number, quality: string, roman: string, label: string) => {
     const wPc = mod12(rootPc + degreeOffset);
     const degree = degreeOfRoman(roman) ?? 1;
     const wNote = spellDegreeAtPc(root, degree, wPc);

     const template = CHORD_SHAPES[quality] || CHORD_SHAPES[''];
     const wRootFret = mod12(wPc - pc('E'));
     const wFrets = createVoicingFromShape(template.eShape, wRootFret);

     allChords.push({
        id: `wild-${wNote}${quality}`,
        root: wNote,
        rootPc: wPc,
        quality: quality,
        name: `${wNote}${quality}`,
        roman: roman,
        function: 'Stranger',
        notes: [wNote, '?', '?'],
        voicings: [{ name: label, frets: wFrets, baseFret: lowestFret(wFrets) }],
        activeVoicingIdx: 0,
        scaleDegree: 0,
        isDiatonic: false,
        category: 'Wildcard'
     });
  };

  if (scaleType === 'Major' || scaleType === 'Mixolydian') {
      addWildcard(10, '', 'bVII', 'Mixolydian Borrow');
      addWildcard(3, '', 'bIII', 'Chromatic Mediant');
      addWildcard(5, 'm', 'iv', 'Minor Plagal');
      addWildcard(8, '', 'bVI', 'Epic Lift');
  } else { // Minor Contexts
      addWildcard(7, '', 'V', 'Major V (Harmonic)');
      addWildcard(5, '', 'IV', 'Dorian IV');
      addWildcard(1, '', 'bII', 'Neapolitan');
  }

  // 4. SECONDARY DOMINANTS (Jazz) — a dominant 7th a fifth above each
  // major/minor diatonic degree, tonicising it (V7/ii, V7/V, …). Skip the
  // tonic (that is the primary V) and diminished/augmented degrees, which
  // have no stable target.
  if (style === 'Jazz') {
    const shapeVoicing = (shape: number[], rootPitch: number, ref: string, label: string): Voicing => {
      const rootFret = mod12(rootPitch - pc(ref));
      const frets = createVoicingFromShape(shape, rootFret);
      return { name: label, frets, baseFret: lowestFret(frets) };
    };

    scaleNotes.forEach((targetName, i) => {
      if (i === 0) return;
      if (triadQuality[i] !== '' && triadQuality[i] !== 'm') return;

      const domName = spelledInterval(targetName, 4, 7); // perfect fifth above the target
      const domPc = noteToPc(domName);
      const third = spelledInterval(domName, 2, 4);
      const fifth = spelledInterval(domName, 4, 7);
      const seventh = spelledInterval(domName, 6, 10);
      const dom = CHORD_SHAPES['7'];

      allChords.push({
        id: `sec-${domName}7-${baseRoman[i]}`,
        root: domName,
        rootPc: domPc,
        quality: '7',
        name: `${domName}7`,
        roman: `V7/${baseRoman[i]}`,
        function: 'Tension',
        notes: [domName, third, fifth, seventh],
        voicings: [
          shapeVoicing(dom.eShape, domPc, 'E', `Root on E (Fret ${mod12(domPc - pc('E')) || 12})`),
          shapeVoicing(dom.aShape, domPc, 'A', `Root on A (Fret ${mod12(domPc - pc('A')) || 12})`),
        ],
        activeVoicingIdx: 0,
        scaleDegree: 0,
        isDiatonic: false,
        category: 'Secondary',
        resolvesTo: baseRoman[i],
      });
    });
  }

  return allChords;
};
