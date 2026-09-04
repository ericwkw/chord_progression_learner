import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveProgression,
  loadProgression,
  clearProgression,
  restoreChords,
  templateIdOf,
  hasSeenGuide,
  markGuideSeen,
  type SavedState,
} from './persistence';
import { generateKeyChords } from '../engine/theory';

const sample: SavedState = {
  root: 'C',
  scaleType: 'Major',
  style: 'Pop',
  chords: [
    { templateId: 'C-0-', activeVoicingIdx: 0 },
    { templateId: 'G-4-', activeVoicingIdx: 2 },
  ],
};

beforeEach(() => {
  localStorage.clear();
});

describe('templateIdOf', () => {
  it('strips the trailing -<seq> from a progression chord id', () => {
    expect(templateIdOf('C-0--17')).toBe('C-0-');
    expect(templateIdOf('wild-A#-3')).toBe('wild-A#');
    expect(templateIdOf('Csus4-0-sus4-42')).toBe('Csus4-0-sus4');
  });
});

describe('save / load / clear', () => {
  it('round-trips a saved state', () => {
    saveProgression(sample);
    expect(loadProgression()).toEqual(sample);
  });

  it('returns null when nothing is stored', () => {
    expect(loadProgression()).toBeNull();
  });

  it('returns null for malformed / foreign data', () => {
    localStorage.setItem('chordlab:progression:v1', '{not json');
    expect(loadProgression()).toBeNull();
    localStorage.setItem('chordlab:progression:v1', JSON.stringify({ root: 'C' }));
    expect(loadProgression()).toBeNull();
  });

  it('clear removes the stored state', () => {
    saveProgression(sample);
    clearProgression();
    expect(loadProgression()).toBeNull();
  });

  it('swallows storage errors', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveProgression(sample)).not.toThrow();
    spy.mockRestore();
  });
});

describe('restoreChords', () => {
  const palette = generateKeyChords('C', 'Major', 'Pop');

  it('rebuilds chords from templates with fresh unique ids', () => {
    let n = 0;
    const restored = restoreChords(sample.chords, palette, () => ++n);
    expect(restored).toHaveLength(2);
    expect(restored[0].name).toBe('C');
    expect(restored[1].name).toBe('G');
    expect(restored[0].id).not.toEqual(restored[1].id);
    expect(restored[1].activeVoicingIdx).toBe(2);
  });

  it('skips templates that no longer exist in the palette', () => {
    const restored = restoreChords(
      [{ templateId: 'does-not-exist', activeVoicingIdx: 0 }, ...sample.chords],
      palette,
      (() => { let n = 0; return () => ++n; })(),
    );
    expect(restored).toHaveLength(2);
  });

  it('clamps an out-of-range voicing index to 0', () => {
    const restored = restoreChords(
      [{ templateId: 'C-0-', activeVoicingIdx: 999 }],
      palette,
      () => 1,
    );
    expect(restored[0].activeVoicingIdx).toBe(0);
  });
});

describe('guide-seen flag', () => {
  it('defaults to false, true after markGuideSeen', () => {
    expect(hasSeenGuide()).toBe(false);
    markGuideSeen();
    expect(hasSeenGuide()).toBe(true);
  });
});
