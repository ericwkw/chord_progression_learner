import { describe, it, expect } from 'vitest';
import {
  noteToPc,
  spellWithLetter,
  spellPlain,
  spellScale,
  spellDegreeAtPc,
  degreeOfRoman,
  isFlatKey,
} from './notes';
import { SCALE_PATTERNS } from './theory';

describe('noteToPc', () => {
  it('reads letters and accidentals', () => {
    expect(noteToPc('C')).toBe(0);
    expect(noteToPc('Bb')).toBe(10);
    expect(noteToPc('A#')).toBe(10);
    expect(noteToPc('B#')).toBe(0);
    expect(noteToPc('Cb')).toBe(11);
    expect(noteToPc('F##')).toBe(7);
    expect(noteToPc('Ebb')).toBe(2);
  });
});

describe('spellWithLetter', () => {
  it('spells a pitch class onto a chosen letter', () => {
    expect(spellWithLetter(10, 'B')).toBe('Bb');
    expect(spellWithLetter(10, 'A')).toBe('A#');
    expect(spellWithLetter(0, 'C')).toBe('C');
    expect(spellWithLetter(0, 'B')).toBe('B#');
  });

  it('returns null past the accidental budget', () => {
    // D# (pc 3) forced onto letter C needs 3 sharps → over a 2-accidental budget
    expect(spellWithLetter(3, 'C', 2)).toBeNull();
    expect(spellWithLetter(3, 'C', 3)).toBe('C###');
    expect(spellWithLetter(3, 'D', 2)).toBe('D#');
  });
});

describe('spellPlain', () => {
  it('gives a single-accidental name on the requested side', () => {
    expect(spellPlain(1, 'sharp')).toBe('C#');
    expect(spellPlain(1, 'flat')).toBe('Db');
    expect(spellPlain(6, 'flat')).toBe('Gb');
  });
});

describe('isFlatKey', () => {
  it('flags the flat side of the circle, including F', () => {
    expect(isFlatKey('F')).toBe(true);
    expect(isFlatKey('Bb')).toBe(true);
    expect(isFlatKey('Ab')).toBe(true);
    expect(isFlatKey('C')).toBe(false);
    expect(isFlatKey('G')).toBe(false);
    expect(isFlatKey('F#')).toBe(false);
  });
});

describe('spellScale', () => {
  it('C major → C D E F G A B', () => {
    expect(spellScale('C', SCALE_PATTERNS['Major'])).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  });

  it('F major → F G A Bb C D E', () => {
    expect(spellScale('F', SCALE_PATTERNS['Major'])).toEqual(['F', 'G', 'A', 'Bb', 'C', 'D', 'E']);
  });

  it('F# major → F# G# A# B C# D# E# (has E#)', () => {
    expect(spellScale('F#', SCALE_PATTERNS['Major'])).toEqual([
      'F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#',
    ]);
  });

  it('Db major → Db Eb F Gb Ab Bb C', () => {
    expect(spellScale('Db', SCALE_PATTERNS['Major'])).toEqual([
      'Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C',
    ]);
  });

  it('C Locrian → C Db Eb F Gb Ab Bb', () => {
    expect(spellScale('C', SCALE_PATTERNS['Locrian'])).toEqual([
      'C', 'Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb',
    ]);
  });

  it('always uses each letter exactly once', () => {
    for (const root of ['C', 'F', 'Bb', 'Eb', 'Ab', 'B', 'F#', 'Db', 'A', 'E']) {
      for (const scale of Object.keys(SCALE_PATTERNS)) {
        const letters = spellScale(root, SCALE_PATTERNS[scale]).map(n => n[0]);
        expect(new Set(letters).size, `${root} ${scale}`).toBe(7);
      }
    }
  });
});

describe('spellDegreeAtPc / degreeOfRoman', () => {
  it('degreeOfRoman ignores case and accidentals', () => {
    expect(degreeOfRoman('bVII')).toBe(7);
    expect(degreeOfRoman('iv')).toBe(4);
    expect(degreeOfRoman('V')).toBe(5);
  });

  it('spells a borrowed degree by letter', () => {
    // bVII in C = pitch class 10, degree 7 → letter B → "Bb"
    expect(spellDegreeAtPc('C', 7, 10)).toBe('Bb');
    // bII in C = pitch class 1, degree 2 → letter D → "Db"
    expect(spellDegreeAtPc('C', 2, 1)).toBe('Db');
  });
});
