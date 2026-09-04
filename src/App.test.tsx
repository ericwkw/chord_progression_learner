import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockGenerateContent = vi.fn().mockResolvedValue({ text: 'Mock progression analysis.' });
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
  },
}));

import App from '../index';

const dismissGuide = async (user: ReturnType<typeof userEvent.setup>) => {
  const start = screen.queryByRole('button', { name: /start creating/i });
  if (start) await user.click(start);
};

// The diatonic palette buttons and the progression chips can share a label
// (e.g. "C"). Palette buttons live in the "Diatonic Chords" section.
const paletteButton = (name: string) => {
  const heading = screen.getByRole('heading', { name: /diatonic chords/i });
  const section = heading.parentElement as HTMLElement;
  return within(section).getByRole('button', { name });
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('App — smoke', () => {
  it('renders the guide modal on first mount and dismisses it', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText(/welcome to chordlab/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /start creating/i }));
    expect(screen.queryByText(/welcome to chordlab/i)).not.toBeInTheDocument();
  });

  it('shows the empty state until a chord is added, then renders a fretboard', async () => {
    const user = userEvent.setup();
    render(<App />);
    await dismissGuide(user);

    expect(screen.getByText(/select a chord to view voicing/i)).toBeInTheDocument();

    await user.click(paletteButton('C I'));

    expect(screen.queryByText(/select a chord to view voicing/i)).not.toBeInTheDocument();
    // "Current Voicing" control appears once a chord is selected.
    expect(screen.getByText(/current voicing/i)).toBeInTheDocument();
  });

  it('adds chips to the progression and shows a transition badge between two chords', async () => {
    const user = userEvent.setup();
    render(<App />);
    await dismissGuide(user);

    await user.click(paletteButton('C I'));
    await user.click(paletteButton('G V'));

    // I → V is a half cadence; the transition badge names it.
    expect(screen.getByText('Half')).toBeInTheDocument();
  });

  it('reveals the AI Analyst panel once the progression has 2+ chords and returns feedback', async () => {
    const user = userEvent.setup();
    render(<App />);
    await dismissGuide(user);

    await user.click(paletteButton('C I'));
    await user.click(paletteButton('F IV'));

    const analyze = await screen.findByRole('button', { name: /analyze/i });
    await user.click(analyze);

    expect(await screen.findByText(/mock progression analysis/i)).toBeInTheDocument();
  });

  it('clears the progression when the key changes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await dismissGuide(user);

    await user.click(paletteButton('C I'));
    await user.click(paletteButton('G V'));
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();

    await user.selectOptions(screen.getByDisplayValue('C'), 'D');

    expect(screen.queryByRole('button', { name: /analyze/i })).not.toBeInTheDocument();
    expect(screen.getByText(/tap chords below to start building/i)).toBeInTheDocument();
  });

  it('cycles voicings with the next / prev controls', async () => {
    const user = userEvent.setup();
    render(<App />);
    await dismissGuide(user);

    await user.click(paletteButton('C I'));

    const label = () => screen.getByText(/current voicing/i).parentElement?.textContent ?? '';
    const first = label();

    // The two chevron buttons flank the "Current Voicing" text.
    const buttons = screen.getAllByRole('button');
    const nextBtn = buttons.find(b => b.querySelector('svg.lucide-chevron-right'));
    expect(nextBtn).toBeTruthy();
    await user.click(nextBtn!);

    expect(label()).not.toEqual(first);
  });

  it('shows a Secondary Dominants section only in the Jazz style', async () => {
    const user = userEvent.setup();
    render(<App />);
    await dismissGuide(user);

    expect(screen.queryByRole('heading', { name: /secondary dominants/i })).not.toBeInTheDocument();

    const styleBtns = screen.getAllByRole('button');
    await user.click(styleBtns.find(b => b.textContent === 'Jazz')!);

    const heading = await screen.findByRole('heading', { name: /secondary dominants/i });
    const section = heading.parentElement as HTMLElement;
    expect(within(section).getByRole('button', { name: 'D7 V7/V' })).toBeInTheDocument();
  });
});

describe('App — persistence', () => {
  it('restores the progression and skips the guide after a remount', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await dismissGuide(user);

    await user.click(paletteButton('C I'));
    await user.click(paletteButton('G V'));
    // Two chips in the progression strip.
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();

    first.unmount();
    render(<App />);

    // Guide was marked seen, so it does not reappear.
    expect(screen.queryByText(/welcome to chordlab/i)).not.toBeInTheDocument();
    // The two-chord progression came back (AI panel needs 2+ chords).
    expect(await screen.findByRole('button', { name: /analyze/i })).toBeInTheDocument();
    expect(screen.queryByText(/tap chords below to start building/i)).not.toBeInTheDocument();
  });

  it('clears stored chords when the progression is cleared', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await dismissGuide(user);
    await user.click(paletteButton('C I'));
    await user.click(paletteButton('G V'));

    await user.click(screen.getByRole('button', { name: /^clear$/i }));

    first.unmount();
    render(<App />);
    expect(screen.getByText(/tap chords below to start building/i)).toBeInTheDocument();
  });
});
