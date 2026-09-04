import { describe, it, expect } from 'vitest';
import {
  ROOT_OPTIONS,
  SCALE_PATTERNS,
  generateKeyChords,
  getNoteAtFret,
  type Chord,
} from './theory';

const team = (chords: Chord[]) => chords.filter(c => c.category === 'Team');
const names = (chords: Chord[]) => chords.map(c => c.name);

describe('generateKeyChords — enharmonic spelling', () => {
  it('F major uses Bb, not A#', () => {
    const t = team(generateKeyChords('F', 'Major', 'Pop'));
    expect(t.map(c => c.root)).toEqual(['F', 'G', 'A', 'Bb', 'C', 'D', 'E']);
    expect(t.map(c => c.name)).toEqual(['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'Edim']);
  });

  it('Eb major spells all flats (Eb F G Ab Bb C D)', () => {
    expect(team(generateKeyChords('Eb', 'Major', 'Pop')).map(c => c.root)).toEqual([
      'Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D',
    ]);
  });

  it('B major spells sharps including A# (B C# D# E F# G# A#)', () => {
    expect(team(generateKeyChords('B', 'Major', 'Pop')).map(c => c.root)).toEqual([
      'B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#',
    ]);
  });

  it('D natural minor uses Bb (D E F G A Bb C)', () => {
    expect(team(generateKeyChords('D', 'Natural Minor', 'Pop')).map(c => c.root)).toEqual([
      'D', 'E', 'F', 'G', 'A', 'Bb', 'C',
    ]);
  });

  it('every diatonic scale spells one of each letter A–G', () => {
    for (const root of ROOT_OPTIONS) {
      for (const scale of Object.keys(SCALE_PATTERNS)) {
        const letters = team(generateKeyChords(root, scale, 'Pop')).map(c => c.root[0]);
        expect(new Set(letters).size, `${root} ${scale}`).toBe(7);
      }
    }
  });

  it('rootPc is spelling-independent', () => {
    const f = team(generateKeyChords('F', 'Major', 'Pop'));
    expect(f[3].root).toBe('Bb');
    expect(f[3].rootPc).toBe(10); // A#/Bb
  });

  it('borrowed chords in F are spelled flat (bVII = Eb, bVI = Db)', () => {
    const wild = generateKeyChords('F', 'Major', 'Pop').filter(c => c.category === 'Wildcard');
    const byRoman = Object.fromEntries(wild.map(c => [c.roman, c.root]));
    expect(byRoman['bVII']).toBe('Eb');
    expect(byRoman['bVI']).toBe('Db');
    expect(byRoman['bIII']).toBe('Ab');
  });
});

describe('generateKeyChords — diatonic triads', () => {
  it('C Major / Pop → C Dm Em F G Am Bdim', () => {
    expect(names(team(generateKeyChords('C', 'Major', 'Pop')))).toEqual([
      'C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim',
    ]);
  });

  it('A Natural Minor / Pop → Am Bdim C Dm Em F G', () => {
    expect(names(team(generateKeyChords('A', 'Natural Minor', 'Pop')))).toEqual([
      'Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G',
    ]);
  });

  it('G Major / Pop → G Am Bm C D Em F#dim', () => {
    expect(names(team(generateKeyChords('G', 'Major', 'Pop')))).toEqual([
      'G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim',
    ]);
  });
});

describe('generateKeyChords — jazz sevenths', () => {
  it('C Major / Jazz → maj7 / m7 / dom7 / m7b5 stack', () => {
    expect(names(team(generateKeyChords('C', 'Major', 'Jazz')))).toEqual([
      'Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5',
    ]);
  });

  it('qualities are tagged, not just names', () => {
    const q = team(generateKeyChords('C', 'Major', 'Jazz')).map(c => c.quality);
    expect(q).toEqual(['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5']);
  });
});

describe('generateKeyChords — augmented & diminished chords', () => {
  it('C Harmonic Minor / Pop: III is augmented, vii is diminished', () => {
    const t = team(generateKeyChords('C', 'Harmonic Minor', 'Pop'));
    expect(t[2].quality).toBe('aug');
    expect(t[2].name).toBe('Ebaug');
    expect(t[2].roman).toBe('III+');
    expect(t[6].quality).toBe('dim');
    expect(t[6].roman).toBe('vii°');
  });

  it('C Harmonic Minor / Jazz: full 7th harmonization', () => {
    const q = team(generateKeyChords('C', 'Harmonic Minor', 'Jazz')).map(c => c.quality);
    expect(q).toEqual(['mMaj7', 'm7b5', 'maj7#5', 'm7', '7', 'maj7', 'dim7']);
  });

  it('C Harmonic Minor / Jazz: III is spelled and labelled as augmented-major 7th', () => {
    const three = team(generateKeyChords('C', 'Harmonic Minor', 'Jazz'))[2];
    expect(three.name).toBe('Ebmaj7#5');
    expect(three.roman).toBe('III+Maj7');
  });

  it('C Melodic Minor / Pop: III is augmented', () => {
    expect(team(generateKeyChords('C', 'Melodic Minor (Jazz)', 'Pop'))[2].quality).toBe('aug');
  });

  it('augmented voicings actually voice an augmented triad (root, +4, +8)', () => {
    // Eb aug = Eb G B. Check the primary voicing's fretted pitch classes.
    for (const scale of ['Harmonic Minor', 'Melodic Minor (Jazz)']) {
      const three = team(generateKeyChords('C', scale, 'Pop'))[2];
      const openStrings = [4, 9, 2, 7, 11, 4]; // E A D G B E
      const pcs = new Set(
        three.voicings[0].frets
          .map((f, s) => (f === -1 ? null : (openStrings[s] + f) % 12))
          .filter((x): x is number => x !== null),
      );
      expect([...pcs].sort((a, b) => a - b), scale).toEqual([3, 7, 11]); // Eb G B
    }
  });

  it('half-diminished keeps ø and never gains a °', () => {
    const two = team(generateKeyChords('C', 'Harmonic Minor', 'Jazz'))[1];
    expect(two.roman).toContain('ø');
    expect(two.roman).not.toContain('°');
  });

  it('fully-diminished 7th roman is vii°7, not the old doubled "vii7°7"', () => {
    expect(team(generateKeyChords('C', 'Harmonic Minor', 'Jazz'))[6].roman).toBe('vii°7');
  });
});

describe('generateKeyChords — secondary dominants', () => {
  const secondary = (chords: Chord[]) => chords.filter(c => c.category === 'Secondary');

  it('only appear in the Jazz style', () => {
    expect(secondary(generateKeyChords('C', 'Major', 'Pop'))).toHaveLength(0);
    expect(secondary(generateKeyChords('C', 'Major', 'Blues'))).toHaveLength(0);
    expect(secondary(generateKeyChords('C', 'Major', 'Jazz')).length).toBeGreaterThan(0);
  });

  it('C major / Jazz → V7 of ii, iii, IV, V, vi (not I or vii°)', () => {
    const s = secondary(generateKeyChords('C', 'Major', 'Jazz'));
    expect(s.map(c => c.name)).toEqual(['A7', 'B7', 'C7', 'D7', 'E7']);
    expect(s.map(c => c.roman)).toEqual(['V7/ii', 'V7/iii', 'V7/IV', 'V7/V', 'V7/vi']);
    expect(s.every(c => c.quality === '7' && c.function === 'Tension')).toBe(true);
  });

  it('each secondary dominant is a dominant-7 chord a fifth above its target', () => {
    const s = secondary(generateKeyChords('C', 'Major', 'Jazz'));
    const vOfV = s.find(c => c.roman === 'V7/V')!;
    expect(vOfV.name).toBe('D7');            // a 5th above G
    expect(vOfV.notes).toEqual(['D', 'F#', 'A', 'C']);
    expect(vOfV.resolvesTo).toBe('V');
  });

  it('minor key / Jazz skips the tonic and the diminished ii°', () => {
    const s = secondary(generateKeyChords('A', 'Natural Minor', 'Jazz'));
    expect(s.map(c => c.roman)).toEqual(['V7/III', 'V7/iv', 'V7/v', 'V7/VI', 'V7/VII']);
  });

  it('secondary-dominant voicings are playable 6-string shapes', () => {
    for (const c of secondary(generateKeyChords('Eb', 'Major', 'Jazz'))) {
      expect(c.voicings[0].frets).toHaveLength(6);
      expect(c.voicings[0].frets.every(f => f >= -1 && f <= 17)).toBe(true);
    }
  });
});

describe('generateKeyChords — blues dominant cycle', () => {
  it('C Major / Blues → I IV V are dominant 7ths', () => {
    const t = team(generateKeyChords('C', 'Major', 'Blues'));
    expect(t[0].name).toBe('C7');
    expect(t[3].name).toBe('F7');
    expect(t[4].name).toBe('G7');
    expect(t[0].quality).toBe('7');
  });
});

describe('functional harmony roles', () => {
  it('C Major: I is Home, V is Tension', () => {
    const t = team(generateKeyChords('C', 'Major', 'Pop'));
    expect(t[0].function).toBe('Home');
    expect(t[4].function).toBe('Tension');
  });
});

describe('voicing integrity — every key/scale/style', () => {
  const styles = ['Pop', 'Jazz', 'Blues'];

  it('all voicings have 6 finite, in-range frets and a finite baseFret', () => {
    for (const root of ROOT_OPTIONS) {
      for (const scale of Object.keys(SCALE_PATTERNS)) {
        for (const style of styles) {
          const chords = generateKeyChords(root, scale, style);
          for (const chord of chords) {
            expect(chord.voicings.length).toBeGreaterThan(0);
            for (const v of chord.voicings) {
              const ctx = `${root} ${scale} ${style} ${chord.name} "${v.name}"`;
              expect(v.frets, ctx).toHaveLength(6);
              for (const f of v.frets) {
                expect(Number.isFinite(f), `${ctx} fret ${f}`).toBe(true);
                expect(f, ctx).toBeGreaterThanOrEqual(-1);
                expect(f, ctx).toBeLessThanOrEqual(20);
              }
              expect(Number.isFinite(v.baseFret), `${ctx} baseFret ${v.baseFret}`).toBe(true);
              expect(v.baseFret, ctx).toBeGreaterThanOrEqual(0);
            }
          }
        }
      }
    }
  });
});

describe('getNoteAtFret', () => {
  it('open strings are standard tuning E2 A2 D3 G3 B3 E4 (as pitch classes)', () => {
    expect([0, 1, 2, 3, 4, 5].map(s => getNoteAtFret(s, 0))).toEqual([
      { pc: 4, octave: 2 },  // E
      { pc: 9, octave: 2 },  // A
      { pc: 2, octave: 3 },  // D
      { pc: 7, octave: 3 },  // G
      { pc: 11, octave: 3 }, // B
      { pc: 4, octave: 4 },  // E
    ]);
  });

  it('low E string, 12th fret → E3 (octave up from open)', () => {
    expect(getNoteAtFret(0, 12)).toEqual({ pc: 4, octave: 3 });
  });

  it('low E string, 8th fret → C3 (octave rolls over at C, not at the open note)', () => {
    expect(getNoteAtFret(0, 8)).toEqual({ pc: 0, octave: 3 });
  });

  it('muted string → null', () => {
    expect(getNoteAtFret(0, -1)).toBeNull();
  });
});

describe('CAGED voicings', () => {
  const OPEN = [4, 9, 2, 7, 11, 4];
  const pcSet = (frets: number[]) =>
    [...new Set(frets.map((f, s) => (f === -1 ? -1 : (OPEN[s] + f) % 12)).filter(x => x !== -1))].sort();

  it('a plain major triad offers all five CAGED shapes', () => {
    const c = team(generateKeyChords('C', 'Major', 'Pop'))[0];
    const shapes = c.voicings.map(v => v.name);
    expect(shapes.filter(n => /Shape$/.test(n))).toEqual(['C Shape', 'G Shape', 'D Shape']);
    // plus the E-shape and A-shape barre positions already generated
    expect(c.voicings.length).toBeGreaterThanOrEqual(5);
  });

  it('the C Shape for C major is the open-C chord', () => {
    const c = team(generateKeyChords('C', 'Major', 'Pop'))[0];
    expect(c.voicings.find(v => v.name === 'C Shape')!.frets).toEqual([-1, 3, 2, 0, 1, 0]);
  });

  it('a plain minor triad offers the Dm shape', () => {
    const am = team(generateKeyChords('A', 'Natural Minor', 'Pop'))[0];
    expect(am.voicings.some(v => v.name === 'Dm Shape')).toBe(true);
  });

  it('every CAGED voicing spells the same triad as the barre chord, on ≥4 strings, in range', () => {
    for (const root of ROOT_OPTIONS) {
      for (const scale of ['Major', 'Natural Minor']) {
        for (const c of team(generateKeyChords(root, scale, 'Pop'))) {
          const want = JSON.stringify(pcSet(c.voicings[0].frets));
          for (const v of c.voicings.filter(x => /Shape$/.test(x.name))) {
            const ctx = `${root} ${scale} ${c.name} ${v.name}`;
            expect(JSON.stringify(pcSet(v.frets)), ctx).toBe(want);
            expect(v.frets.filter(f => f !== -1).length, ctx).toBeGreaterThanOrEqual(4);
            for (const f of v.frets) expect(f, ctx).toBeGreaterThanOrEqual(-1);
            expect(Math.max(...v.frets), ctx).toBeLessThanOrEqual(15);
          }
        }
      }
    }
  });

  it('extended / 7th chords do NOT get CAGED shapes (only E/A + inversions)', () => {
    const cmaj7 = team(generateKeyChords('C', 'Major', 'Jazz'))[0];
    expect(cmaj7.voicings.some(v => /Shape$/.test(v.name))).toBe(false);
  });
});

describe('inversions / slash chords (current behavior)', () => {
  it('C major produces a /E and a /G voicing', () => {
    const cMajor = team(generateKeyChords('C', 'Major', 'Pop'))[0];
    const voicingNames = cMajor.voicings.map(v => v.name).join(' | ');
    expect(voicingNames).toMatch(/\/E/);
    expect(voicingNames).toMatch(/\/G/);
  });

  it('A minor produces a /C voicing', () => {
    const aMinor = team(generateKeyChords('A', 'Natural Minor', 'Pop'))[0];
    expect(aMinor.voicings.map(v => v.name).join(' | ')).toMatch(/\/C/);
  });
});

// ---------------------------------------------------------------------------
// Regression specs for the FIX_PLAN Phase 2 bug fixes (landed in PR3).
// ---------------------------------------------------------------------------
describe('bug fixes (FIX_PLAN Phase 2)', () => {
  it('2.3 — open-position voicings report baseFret 0, not 1', () => {
    // E major triad in the key of E: low string is open (fret 0).
    const eMajor = team(generateKeyChords('E', 'Major', 'Pop'))[0];
    expect(eMajor.voicings[0].baseFret).toBe(0);
  });

  it('2.4 — a first-inversion voicing is offered even when the 3rd sits at the nut', () => {
    // C major: 3rd = E = fret 0 on the low E string. The shape is now
    // retried an octave up instead of being dropped.
    const cMajor = team(generateKeyChords('C', 'Major', 'Pop'))[0];
    expect(cMajor.voicings.map(v => v.name).join(' | ')).toMatch(/\/E \(Bass on E\)/);
  });

  it('2.7 — diminished triads carry a ° roman marker', () => {
    const bDim = team(generateKeyChords('C', 'Major', 'Pop'))[6];
    expect(bDim.name).toBe('Bdim');
    expect(bDim.roman).toContain('°');
  });

  it('2.7 — half-diminished (m7b5) keeps its ø marker, not °', () => {
    const bHalfDim = team(generateKeyChords('C', 'Major', 'Jazz'))[6];
    expect(bHalfDim.roman).toContain('ø');
    expect(bHalfDim.roman).not.toContain('°');
  });
});
