// --- MUSIC THEORY ENGINE ---

export const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

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
  quality: string; // 'm', 'maj', 'dim', '7'
  name: string;
  roman: string;
  function: 'Home' | 'Adventure' | 'Tension' | 'Stranger' | 'Spice'; // Functional harmony role
  notes: string[];
  voicings: Voicing[];
  activeVoicingIdx: number;
  scaleDegree: number;
  isDiatonic: boolean;
  category: 'Team' | 'Variation' | 'Wildcard';
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

export const getNoteAtFret = (stringIdx: number, fret: number) => {
  if (fret === -1) return null;
  const openNote = GUITAR_TUNING[stringIdx];
  const openNoteIdx = ALL_NOTES.indexOf(openNote.note);
  const totalSemis = openNoteIdx + fret;
  const noteName = ALL_NOTES[totalSemis % 12];
  const octaveBoost = Math.floor(totalSemis / 12);
  return { note: noteName, octave: openNote.octave + octaveBoost };
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

const getQualityFromIntervals = (third: number, fifth: number, seventh: number | null): string => {
    if (seventh !== null) {
      if (third === 4 && fifth === 7 && seventh === 11) return 'maj7';
      if (third === 4 && fifth === 7 && seventh === 10) return '7'; // Dom7
      if (third === 3 && fifth === 7 && seventh === 10) return 'm7';
      if (third === 3 && fifth === 7 && seventh === 11) return 'mMaj7'; // Jazz Minor I
      if (third === 3 && fifth === 6 && seventh === 10) return 'm7b5'; // Half Dim
      if (third === 3 && fifth === 6 && seventh === 9) return 'dim7'; // Full Dim
    }
    // Fallback to Triads
    if (third === 4 && fifth === 7) return '';
    if (third === 3 && fifth === 7) return 'm';
    if (third === 3 && fifth === 6) return 'dim';
    return '';
};

// Generates chords for a specific key and style
export const generateKeyChords = (root: string, scaleType: string, style: string): Chord[] => {
  const rootIdx = ALL_NOTES.indexOf(root);
  const pattern = SCALE_PATTERNS[scaleType];
  const scaleNotes = pattern.map(interval => ALL_NOTES[(rootIdx + interval) % 12]);

  const allChords: Chord[] = [];

  // 1. DIATONIC TEAM
  scaleNotes.forEach((note, i) => {
    const chordRootVal = ALL_NOTES.indexOf(note);

    let thirdNote = scaleNotes[(i + 2) % 7];
    let fifthNote = scaleNotes[(i + 4) % 7];
    let seventhNote = scaleNotes[(i + 6) % 7];

    let useSevenths = (style === 'Jazz' || style === 'Blues');
    let isBluesDominant = false;

    // Blues Override
    if (style === 'Blues' && (i === 0 || i === 3 || i === 4)) {
       isBluesDominant = true;
       thirdNote = ALL_NOTES[(chordRootVal + 4) % 12];
       seventhNote = ALL_NOTES[(chordRootVal + 10) % 12];
       useSevenths = true;
    }

    const thirdVal = ALL_NOTES.indexOf(thirdNote);
    const fifthVal = ALL_NOTES.indexOf(fifthNote);
    const seventhVal = ALL_NOTES.indexOf(seventhNote);

    const thirdInterval = (thirdVal - chordRootVal + 12) % 12;
    const fifthInterval = (fifthVal - chordRootVal + 12) % 12;
    const seventhInterval = (seventhVal - chordRootVal + 12) % 12;

    let quality = getQualityFromIntervals(thirdInterval, fifthInterval, useSevenths ? seventhInterval : null);

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
    if (quality.includes('7')) roman += '7';
    if (quality === 'maj7') roman = roman.replace('7', 'Maj7');
    if (quality === 'm7b5') roman += 'ø';
    if (quality === 'dim7') roman += '°7';
    if (quality === 'dim') roman += '°';

    // Build Chord Object
    const buildChord = (q: string, n: string, r: string, f: Chord['function'], cat: Chord['category'], customId: string = '') => {
        const voicings: Voicing[] = [];
        let shapeKey = q;
        if (!CHORD_SHAPES[shapeKey]) {
            if (q === 'mMaj7') shapeKey = 'm7';
            else if (q.startsWith('m')) shapeKey = 'm';
            else if (q.startsWith('dim')) shapeKey = 'dim';
            else shapeKey = '';
        }
        const shapeTemplate = CHORD_SHAPES[shapeKey] || CHORD_SHAPES[''];

        // E-Shape
        const eStringIdx = ALL_NOTES.indexOf('E');
        const eShapeRootFret = (ALL_NOTES.indexOf(n) - eStringIdx + 12) % 12;
        const eFrets = createVoicingFromShape(shapeTemplate.eShape, eShapeRootFret);
        const isEBarre = eFrets.some(fr => fr > 0) && eShapeRootFret > 0;
        voicings.push({
            name: !isEBarre ? "Open / Bottom" : `Root on E (Fret ${eShapeRootFret || 12})`,
            frets: eFrets,
            baseFret: lowestFret(eFrets)
        });

        // A-Shape
        const aStringIdx = ALL_NOTES.indexOf('A');
        const aShapeRootFret = (ALL_NOTES.indexOf(n) - aStringIdx + 12) % 12;
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
            // Find 3rd note fret on E string
            const thirdNoteName = thirdNote;
            const thirdE_Fret = (ALL_NOTES.indexOf(thirdNoteName) - eStringIdx + 12) % 12;
            const shapeNameE = isMinor ? 'Min_3_E' : 'Maj_3_E';
            const invFretsE = createInversionVoicing(INVERSION_SHAPES[shapeNameE], thirdE_Fret);
            if (invFretsE) {
                voicings.push({
                    name: `/${thirdNoteName} (Bass on E)`,
                    frets: invFretsE,
                    baseFret: lowestFret(invFretsE)
                });
            }

            // Find 3rd note fret on A string
            const thirdA_Fret = (ALL_NOTES.indexOf(thirdNoteName) - aStringIdx + 12) % 12;
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
             const fifthE_Fret = (ALL_NOTES.indexOf(fifthNoteName) - eStringIdx + 12) % 12;
             const invFrets5 = createInversionVoicing(INVERSION_SHAPES['Maj_5_E'], fifthE_Fret);
             if (invFrets5) {
                voicings.push({
                    name: `/${fifthNoteName} (Bass on E)`,
                    frets: invFrets5,
                    baseFret: lowestFret(invFrets5)
                });
             }
        }

        // Calculate notes for playback
        const cNotes = [n, thirdNote, fifthNote];

        return {
            id: `${n}${q}-${i}-${customId}`,
            root: n,
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

    // 2. VARIATIONS (Spices)
    // Only generate variations for major/minor chords to keep it musical

    // Sus4 & Sus2
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
     const wIdx = (rootIdx + degreeOffset) % 12;
     const wNote = ALL_NOTES[wIdx];

     // Build Voicing for Wildcard
     const shapeKey = quality;
     const template = CHORD_SHAPES[shapeKey] || CHORD_SHAPES[''];
     const eStringIdx = ALL_NOTES.indexOf('E');
     const wRootFret = (wIdx - eStringIdx + 12) % 12;
     const wFrets = createVoicingFromShape(template.eShape, wRootFret);

     allChords.push({
        id: `wild-${wNote}${quality}`,
        root: wNote,
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
      addWildcard(10, '', 'bVII', 'Mixolydian Borrow'); // bVII Major
      addWildcard(3, '', 'bIII', 'Chromatic Mediant'); // bIII Major
      addWildcard(5, 'm', 'iv', 'Minor Plagal'); // iv Minor
      addWildcard(8, '', 'bVI', 'Epic Lift'); // bVI Major
  } else { // Minor Contexts
      addWildcard(7, '', 'V', 'Major V (Harmonic)'); // V Major
      addWildcard(5, '', 'IV', 'Dorian IV'); // IV Major
      addWildcard(1, '', 'bII', 'Neapolitan'); // bII Major
  }

  return allChords;
};
