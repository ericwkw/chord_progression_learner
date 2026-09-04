import { describe, it, expect } from 'vitest';
import { analyzeTransition, romanDegree } from './harmony';
import { generateKeyChords, type Chord } from './theory';

const cMajorPop = generateKeyChords('C', 'Major', 'Pop');
const cMajorJazz = generateKeyChords('C', 'Major', 'Jazz');

const byRoman = (chords: Chord[], roman: string) =>
  chords.find(c => c.roman === roman) ?? (() => { throw new Error(`no ${roman}`); })();
const team = (roman: string) => byRoman(cMajorPop.filter(c => c.category === 'Team'), roman);
const variation = (name: string) => {
  const c = cMajorPop.find(x => x.category === 'Variation' && x.name === name);
  if (!c) throw new Error(`no variation ${name}`);
  return c;
};

describe('romanDegree', () => {
  it('parses decorated romans', () => {
    expect(romanDegree('V7')).toBe(5);
    expect(romanDegree('vii°')).toBe(7);
    expect(romanDegree('IVMaj7')).toBe(4);
    expect(romanDegree('bVII')).toBe(7);
    expect(romanDegree('V7/V')).toBe(5);
  });
});

describe('analyzeTransition — cadences', () => {
  it('V → I is Authentic', () => {
    expect(analyzeTransition(team('V'), team('I')).label).toBe('Authentic');
  });
  it('V → vi is Deceptive', () => {
    expect(analyzeTransition(team('V'), team('vi')).label).toBe('Deceptive');
  });
  it('IV → I is Plagal', () => {
    expect(analyzeTransition(team('IV'), team('I')).label).toBe('Plagal');
  });
  it('I → V is a Half cadence', () => {
    expect(analyzeTransition(team('I'), team('V')).label).toBe('Half');
  });
});

describe('analyzeTransition — root motion', () => {
  it('iii → vi is Circle of 5ths', () => {
    const t = analyzeTransition(team('iii'), team('vi'));
    expect(t.label).toBe('Circle 5th');
    expect(t.type).toBe('motion');
  });
  it('I → ii is Step', () => {
    expect(analyzeTransition(team('I'), team('ii')).label).toBe('Step');
  });
  it('iii → IV is Half step', () => {
    expect(analyzeTransition(team('iii'), team('IV')).label).toBe('Semitone');
  });
});

describe('analyzeTransition — borrowing & tonicisation', () => {
  it('a secondary dominant into its target is Tonicize', () => {
    const jazzTeam = cMajorJazz.filter(c => c.category === 'Team');
    const vOfV = cMajorJazz.find(c => c.roman === 'V7/V')!;
    const five = jazzTeam.find(c => c.roman === 'V7')!;
    expect(analyzeTransition(vOfV, five).label).toBe('Tonicize');
  });

  it('moving to a borrowed chord is Borrow', () => {
    const bVII = cMajorPop.find(c => c.category === 'Wildcard' && c.roman === 'bVII')!;
    expect(analyzeTransition(team('I'), bVII).label).toBe('Borrow');
  });

  it('a suspension resolving to its triad is Suspension', () => {
    expect(analyzeTransition(variation('Csus4'), team('I')).label).toBe('Suspension');
  });

  it('same root, different quality is Recolour', () => {
    expect(analyzeTransition(team('I'), variation('C6')).label).toBe('Recolour');
  });
});

describe('analyzeTransition — every result carries a detail string', () => {
  it('detail is always non-empty', () => {
    const chords = cMajorJazz;
    for (const a of chords) {
      for (const b of chords) {
        if (a === b) continue;
        expect(analyzeTransition(a, b).detail.length).toBeGreaterThan(0);
      }
    }
  });
});
