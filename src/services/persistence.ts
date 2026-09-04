// Lightweight localStorage persistence for the working progression, so a
// refresh doesn't wipe it. Only a compact descriptor is stored — chords are
// rebuilt from the theory engine on load, not deserialized wholesale.

import type { Chord } from '../engine/theory';

const PROGRESSION_KEY = 'chordlab:progression:v1';
const GUIDE_KEY = 'chordlab:seenGuide:v1';

export interface SavedChord {
  templateId: string;
  activeVoicingIdx: number;
}

export interface SavedState {
  root: string;
  scaleType: string;
  style: string;
  chords: SavedChord[];
}

// A progression chord's id is `${templateId}-${seq}`; strip the trailing
// `-<number>` to recover the palette template id.
export const templateIdOf = (chordId: string): string => chordId.replace(/-\d+$/, '');

const isSavedState = (v: unknown): v is SavedState => {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.root === 'string' &&
    typeof s.scaleType === 'string' &&
    typeof s.style === 'string' &&
    Array.isArray(s.chords) &&
    s.chords.every(
      c =>
        c &&
        typeof c === 'object' &&
        typeof (c as SavedChord).templateId === 'string' &&
        Number.isInteger((c as SavedChord).activeVoicingIdx),
    )
  );
};

export const saveProgression = (state: SavedState): void => {
  try {
    localStorage.setItem(PROGRESSION_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota / no storage — non-fatal */
  }
};

export const loadProgression = (): SavedState | null => {
  try {
    const raw = localStorage.getItem(PROGRESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isSavedState(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const clearProgression = (): void => {
  try {
    localStorage.removeItem(PROGRESSION_KEY);
  } catch {
    /* non-fatal */
  }
};

// Rebuild progression chords from a saved descriptor against a freshly
// generated palette. Skips any template that no longer exists.
export const restoreChords = (
  saved: SavedChord[],
  palette: Chord[],
  nextId: () => number,
): Chord[] => {
  const byId = new Map(palette.map(c => [c.id, c]));
  const out: Chord[] = [];
  for (const s of saved) {
    const template = byId.get(s.templateId);
    if (!template) continue;
    const activeVoicingIdx =
      s.activeVoicingIdx >= 0 && s.activeVoicingIdx < template.voicings.length
        ? s.activeVoicingIdx
        : 0;
    out.push({ ...template, id: `${template.id}-${nextId()}`, activeVoicingIdx });
  }
  return out;
};

export const hasSeenGuide = (): boolean => {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1';
  } catch {
    return false;
  }
};

export const markGuideSeen = (): void => {
  try {
    localStorage.setItem(GUIDE_KEY, '1');
  } catch {
    /* non-fatal */
  }
};
