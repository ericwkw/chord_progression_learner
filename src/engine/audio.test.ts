import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFrequency, strumChord } from './audio';

describe('getFrequency', () => {
  it('A4 (pc 9) ≈ 440 Hz', () => {
    expect(getFrequency(9, 4)).toBeCloseTo(440, 1);
  });

  it('C0 ≈ 16.35 Hz and each octave doubles', () => {
    expect(getFrequency(0, 0)).toBeCloseTo(16.35, 1);
    expect(getFrequency(0, 4)).toBeCloseTo(261.63, 1);
  });

  it('non-finite pitch class → 0', () => {
    expect(getFrequency(NaN, 4)).toBe(0);
  });
});

// --- Web Audio stub ------------------------------------------------------
class FakeParam {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}
class FakeOsc {
  type = 'sine';
  frequency = new FakeParam();
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
class FakeGain {
  gain = new FakeParam();
  connect = vi.fn();
}

let oscillators: FakeOsc[];
let gains: FakeGain[];

class FakeAudioContext {
  currentTime = 0;
  state = 'running';
  destination = { id: 'dest' };
  resume = vi.fn();
  createOscillator() { const o = new FakeOsc(); oscillators.push(o); return o; }
  createGain() { const g = new FakeGain(); gains.push(g); return g; }
}

beforeEach(() => {
  oscillators = [];
  gains = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
  (window as any).AudioContext = FakeAudioContext;
});

describe('strumChord', () => {
  it('creates one oscillator + gain per note and wires them to the destination', () => {
    strumChord([
      { pc: 0, octave: 3 },
      { pc: 4, octave: 3 },
      { pc: 7, octave: 3 },
    ]);
    expect(oscillators).toHaveLength(3);
    expect(gains).toHaveLength(3);
    oscillators.forEach((o, i) => {
      expect(o.type).toBe('triangle');
      expect(o.connect).toHaveBeenCalledWith(gains[i]);
      expect(o.start).toHaveBeenCalled();
      expect(o.stop).toHaveBeenCalled();
    });
  });

  it('staggers oscillator start times by ~0.035s (strum)', () => {
    strumChord([
      { pc: 0, octave: 3 },
      { pc: 4, octave: 3 },
    ]);
    const t0 = oscillators[0].start.mock.calls[0][0];
    const t1 = oscillators[1].start.mock.calls[0][0];
    expect(t1 - t0).toBeCloseTo(0.035, 3);
  });

  it('sets oscillator frequency from the pitch class', () => {
    strumChord([{ pc: 9, octave: 4 }]);
    expect(oscillators[0].frequency.value).toBeCloseTo(440, 1);
  });

  it('skips notes with a non-finite pitch class (no dead oscillator)', () => {
    strumChord([
      { pc: 0, octave: 3 },
      { pc: NaN, octave: 3 },
      { pc: 7, octave: 3 },
    ]);
    expect(oscillators).toHaveLength(2);
  });
});
