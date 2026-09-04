import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPrompt, analyzeProgression } from './ai';

const mockGenerateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
  },
}));

const params = {
  root: 'C',
  scaleType: 'Major',
  style: 'Jazz',
  chordNames: ['Cmaj7', 'Am7', 'Dm7', 'G7'],
};

beforeEach(() => {
  mockGenerateContent.mockReset();
});

describe('buildPrompt', () => {
  it('names the key, style and the arrow-joined progression', () => {
    const p = buildPrompt(params);
    expect(p).toContain('key of C Major');
    expect(p).toContain('Musical Style: Jazz');
    expect(p).toContain('Cmaj7 -> Am7 -> Dm7 -> G7');
  });
});

describe('analyzeProgression', () => {
  it('returns the model text', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'ii-V-I with a vi detour.' });
    await expect(analyzeProgression(params)).resolves.toBe('ii-V-I with a vi detour.');
    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: buildPrompt(params),
    });
  });

  it('falls back when the model returns no text', async () => {
    mockGenerateContent.mockResolvedValue({ text: '' });
    await expect(analyzeProgression(params)).resolves.toBe('No feedback generated.');
  });

  it('propagates SDK errors to the caller', async () => {
    mockGenerateContent.mockRejectedValue(new Error('quota'));
    await expect(analyzeProgression(params)).rejects.toThrow('quota');
  });
});
