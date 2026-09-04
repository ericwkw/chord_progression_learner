import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPrompt, analyzeProgression } from './ai';

const params = {
  root: 'C',
  scaleType: 'Major',
  style: 'Jazz',
  chordNames: ['Cmaj7', 'Am7', 'Dm7', 'G7'],
};

const okResponse = (content: string) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }] }),
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('location', { origin: 'https://chordlab.test' });
  vi.stubEnv('API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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
  it('POSTs a chat-completions request and returns the assistant content', async () => {
    fetchMock.mockResolvedValue(okResponse('ii-V-I with a vi detour.'));

    await expect(analyzeProgression(params)).resolves.toBe('ii-V-I with a vi detour.');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/chat\/completions$/);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1]).toEqual({ role: 'user', content: buildPrompt(params) });
  });

  it('defaults to the OpenRouter endpoint and sends its attribution headers', async () => {
    fetchMock.mockResolvedValue(okResponse('...'));
    await analyzeProgression(params);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers['HTTP-Referer']).toBe('https://chordlab.test');
    expect(init.headers['X-Title']).toBe('ChordLab');
  });

  it('reads a reasoning model’s answer from `reasoning` when `content` is empty', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '', reasoning: 'The V7 pulls to I.' } }] }),
    });
    await expect(analyzeProgression(params)).resolves.toBe('The V7 pulls to I.');
  });

  it('falls back when the model returns nothing usable', async () => {
    fetchMock.mockResolvedValue(okResponse('   '));
    await expect(analyzeProgression(params)).resolves.toBe('No feedback generated.');
  });

  it('throws with the status and body on a non-2xx response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, text: async () => 'rate limited' });
    await expect(analyzeProgression(params)).rejects.toThrow(/429.*rate limited/);
  });

  it('throws when no API key is configured', async () => {
    vi.stubEnv('API_KEY', '');
    await expect(analyzeProgression(params)).rejects.toThrow(/No API key/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
