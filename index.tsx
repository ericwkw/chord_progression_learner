import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { Play, RotateCcw, Volume2, Sparkles, BookOpen, Music, X, ChevronRight, ChevronLeft, Eye, EyeOff, Info, ArrowRight, Zap, Home, Map } from 'lucide-react';

// --- DATA STRUCTURES ---

// Guitar tuning frequencies (Standard E) - Extended for higher fret positions
const NOTE_FREQUENCIES: Record<string, number> = {
  'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77, 'C6': 1046.50
};

// Helper to get raw note name from frequency key (e.g. "C#3" -> "C#")
const getRawNote = (noteKey: string) => noteKey.replace(/[0-9]/g, '');

type Voicing = {
  name: string; // e.g. "Open Position", "Barre 3rd Fret"
  frets: number[]; // -1 for mute, 0 for open, 1+ for fret
  fingers: number[]; // 0 for none, 1-4 for fingers
  notes: string[]; // Frequencies keys
  baseFret?: number; // Visual override for where to start rendering the fretboard
};

type ChordFunction = 'Home' | 'Adventure' | 'Tension' | 'Stranger';

type Chord = {
  id?: number; // Unique ID for progression items
  name: string;
  roman: string;
  quality: 'Major' | 'Minor' | 'Diminished' | 'Dominant' | 'Augmented';
  isNonDiatonic?: boolean; // If true, this is a "stranger" chord not in the key
  function: ChordFunction; // Functional Harmony Role
  voicings: Voicing[];
  activeVoicingIdx: number; // Currently selected voicing index
  description: string;
};

type KeyData = {
  name: string;
  scaleNotes: string[]; // The 7 "safe" notes of the key
  chords: Chord[];
};

// Expanded database with multiple voicings
const MUSIC_THEORY: Record<string, KeyData> = {
  'C Major': {
    name: 'C Major',
    scaleNotes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    chords: [
      { 
        name: 'C', roman: 'I', quality: 'Major', function: 'Home', activeVoicingIdx: 0, description: "The 'Home' chord. Stable and happy.",
        voicings: [
          { name: 'Open', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], notes: ['C3', 'E3', 'G3', 'C4', 'E4'] },
          { name: 'Barre (3rd)', frets: [-1, 3, 5, 5, 5, 3], fingers: [0, 1, 2, 3, 4, 1], notes: ['C3', 'G3', 'C4', 'E4', 'G4'], baseFret: 3 },
          { name: 'Barre (8th)', frets: [8, 10, 10, 9, 8, 8], fingers: [1, 3, 4, 2, 1, 1], notes: ['C3', 'G3', 'C4', 'E4', 'G4', 'C5'], baseFret: 8 }
        ]
      },
      { 
        name: 'Dm', roman: 'ii', quality: 'Minor', function: 'Adventure', activeVoicingIdx: 0, description: "Sad, floating, jazzy.",
        voicings: [
          { name: 'Open', frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], notes: ['D3', 'A3', 'D4', 'F4'] },
          { name: 'Barre (5th)', frets: [-1, 5, 7, 7, 6, 5], fingers: [0, 1, 3, 4, 2, 1], notes: ['D3', 'A3', 'D4', 'F4', 'A4'], baseFret: 5 }
        ]
      },
      { 
        name: 'Em', roman: 'iii', quality: 'Minor', function: 'Home', activeVoicingIdx: 0, description: "Darker, bridging chord.",
        voicings: [
          { name: 'Open', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], notes: ['E2', 'B2', 'E3', 'G3', 'B3', 'E4'] },
          { name: 'Barre (7th)', frets: [-1, 7, 9, 9, 8, 7], fingers: [0, 1, 3, 4, 2, 1], notes: ['E3', 'B3', 'E4', 'G4', 'B4'], baseFret: 7 }
        ]
      },
      { 
        name: 'F', roman: 'IV', quality: 'Major', function: 'Adventure', activeVoicingIdx: 0, description: "Adventure time! Lifting up.",
        voicings: [
          { name: 'Barre (1st)', frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], notes: ['F2', 'C3', 'F3', 'A3', 'C4', 'F4'] },
          { name: 'Triad (High)', frets: [-1, -1, 3, 2, 1, 1], fingers: [0, 0, 3, 2, 1, 1], notes: ['F3', 'A3', 'C4', 'F4'] }
        ]
      },
      { 
        name: 'G', roman: 'V', quality: 'Major', function: 'Tension', activeVoicingIdx: 0, description: "Tension. Wants to go to C.",
        voicings: [
          { name: 'Open', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], notes: ['G2', 'B2', 'D3', 'G3', 'B3', 'G4'] },
          { name: 'Barre (3rd)', frets: [3, 5, 5, 4, 3, 3], fingers: [1, 3, 4, 2, 1, 1], notes: ['G2', 'D3', 'G3', 'B3', 'D4', 'G4'], baseFret: 3 }
        ]
      },
      { 
        name: 'Am', roman: 'vi', quality: 'Minor', function: 'Home', activeVoicingIdx: 0, description: "Sad relative of C Major.",
        voicings: [
          { name: 'Open', frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], notes: ['A2', 'E3', 'A3', 'C4', 'E4'] },
          { name: 'Barre (5th)', frets: [5, 7, 7, 5, 5, 5], fingers: [1, 3, 4, 1, 1, 1], notes: ['A2', 'E3', 'A3', 'C4', 'E4', 'A4'], baseFret: 5 }
        ]
      },
      { 
        name: 'Bdim', roman: 'vii°', quality: 'Diminished', function: 'Tension', activeVoicingIdx: 0, description: "Spooky and very tense.",
        voicings: [
          { name: 'Open-ish', frets: [-1, 2, 3, 4, -1, -1], fingers: [0, 1, 2, 4, 0, 0], notes: ['B2', 'F3', 'B3'] }
        ]
      },
      // Non-diatonic / Borrowed Chord
      { 
        name: 'E', roman: 'III', quality: 'Major', isNonDiatonic: true, function: 'Stranger', activeVoicingIdx: 0, description: "THE STRANGER! Uses a G# note (not in C Major scale).",
        voicings: [
          { name: 'Open', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], notes: ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'] }
        ]
      }
    ]
  },
  'G Major': {
    name: 'G Major',
    scaleNotes: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
    chords: [
      { 
        name: 'G', roman: 'I', quality: 'Major', function: 'Home', activeVoicingIdx: 0, description: "Home base for G Major.",
        voicings: [
          { name: 'Open', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], notes: ['G2', 'B2', 'D3', 'G3', 'B3', 'G4'] },
          { name: 'Barre (3rd)', frets: [3, 5, 5, 4, 3, 3], fingers: [1, 3, 4, 2, 1, 1], notes: ['G2', 'D3', 'G3', 'B3', 'D4', 'G4'], baseFret: 3 }
        ]
      },
      { 
        name: 'Am', roman: 'ii', quality: 'Minor', function: 'Adventure', activeVoicingIdx: 0, description: "Soft sadness.",
        voicings: [
          { name: 'Open', frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], notes: ['A2', 'E3', 'A3', 'C4', 'E4'] },
          { name: 'Barre (5th)', frets: [5, 7, 7, 5, 5, 5], fingers: [1, 3, 4, 1, 1, 1], notes: ['A2', 'E3', 'A3', 'C4', 'E4', 'A4'], baseFret: 5 }
        ]
      },
      { 
        name: 'Bm', roman: 'iii', quality: 'Minor', function: 'Home', activeVoicingIdx: 0, description: "Thoughtful minor chord.",
        voicings: [
          { name: 'Barre (2nd)', frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], notes: ['B2', 'F#3', 'B3', 'D4', 'F#4'] },
          { name: 'Barre (7th)', frets: [7, 9, 9, 7, 7, 7], fingers: [1, 3, 4, 1, 1, 1], notes: ['B2', 'F#3', 'B3', 'D4', 'F#4', 'B4'], baseFret: 7 }
        ]
      },
      { 
        name: 'C', roman: 'IV', quality: 'Major', function: 'Adventure', activeVoicingIdx: 0, description: "Bright and lifting.",
        voicings: [
          { name: 'Open', frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], notes: ['C3', 'E3', 'G3', 'C4', 'E4'] },
          { name: 'Barre (3rd)', frets: [-1, 3, 5, 5, 5, 3], fingers: [0, 1, 2, 3, 4, 1], notes: ['C3', 'G3', 'C4', 'E4', 'G4'], baseFret: 3 }
        ]
      },
      { 
        name: 'D', roman: 'V', quality: 'Major', function: 'Tension', activeVoicingIdx: 0, description: "High energy, points to G.",
        voicings: [
          { name: 'Open', frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], notes: ['D3', 'A3', 'D4', 'F#4'] },
          { name: 'Barre (5th)', frets: [-1, 5, 7, 7, 7, 5], fingers: [0, 1, 2, 3, 4, 1], notes: ['D3', 'A3', 'D4', 'F#4', 'A4'], baseFret: 5 }
        ]
      },
      { 
        name: 'Em', roman: 'vi', quality: 'Minor', function: 'Home', activeVoicingIdx: 0, description: "Deep and resonant.",
        voicings: [
          { name: 'Open', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], notes: ['E2', 'B2', 'E3', 'G3', 'B3', 'E4'] },
          { name: 'Barre (7th)', frets: [-1, 7, 9, 9, 8, 7], fingers: [0, 1, 3, 4, 2, 1], notes: ['E3', 'B3', 'E4', 'G4', 'B4'], baseFret: 7 }
        ]
      },
      { 
        name: 'F', roman: 'bVII', quality: 'Major', isNonDiatonic: true, function: 'Stranger', activeVoicingIdx: 0, description: "THE STRANGER! Uses F natural (G Major needs F#). Rock & Roll sound.",
        voicings: [
          { name: 'Barre (1st)', frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], notes: ['F2', 'C3', 'F3', 'A3', 'C4', 'F4'] }
        ]
      }
    ]
  },
  'E Major': {
    name: 'E Major',
    scaleNotes: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
    chords: [
      { name: 'E', roman: 'I', quality: 'Major', function: 'Home', activeVoicingIdx: 0, description: "Bright, open, powerful.", voicings: [{ name: 'Open', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], notes: ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'] }] },
      { name: 'F#m', roman: 'ii', quality: 'Minor', function: 'Adventure', activeVoicingIdx: 0, description: "Melancholic and sharp.", voicings: [{ name: 'Barre (2nd)', frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1], notes: ['F#2', 'C#3', 'F#3', 'A3', 'C#4', 'F#4'] }] },
      { name: 'G#m', roman: 'iii', quality: 'Minor', function: 'Home', activeVoicingIdx: 0, description: "Distant and mysterious.", voicings: [{ name: 'Barre (4th)', frets: [4, 6, 6, 4, 4, 4], fingers: [1, 3, 4, 1, 1, 1], notes: ['G#2', 'D#3', 'G#3', 'B3', 'D#4', 'G#4'], baseFret: 4 }] },
      { name: 'A', roman: 'IV', quality: 'Major', function: 'Adventure', activeVoicingIdx: 0, description: "Lifting and hopeful.", voicings: [{ name: 'Open', frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], notes: ['A2', 'E3', 'A3', 'C#4', 'E4'] }, { name: 'Barre (5th)', frets: [5, 7, 7, 6, 5, 5], fingers: [1, 3, 4, 2, 1, 1], notes: ['A2', 'E3', 'A3', 'C#4', 'E4', 'A4'], baseFret: 5 }] },
      { name: 'B', roman: 'V', quality: 'Major', function: 'Tension', activeVoicingIdx: 0, description: "Strong tension.", voicings: [{ name: 'Barre (2nd)', frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], notes: ['B2', 'F#3', 'B3', 'D#4', 'F#4'] }, { name: 'Barre (7th)', frets: [7, 9, 9, 8, 7, 7], fingers: [1, 3, 4, 2, 1, 1], notes: ['B2', 'F#3', 'B3', 'D#4', 'F#4', 'B4'], baseFret: 7 }] },
      { name: 'C#m', roman: 'vi', quality: 'Minor', function: 'Home', activeVoicingIdx: 0, description: "Emotional center.", voicings: [{ name: 'Barre (4th)', frets: [-1, 4, 6, 6, 5, 4], fingers: [0, 1, 3, 4, 2, 1], notes: ['C#3', 'G#3', 'C#4', 'E4', 'G#4'], baseFret: 4 }] },
      { name: 'G', roman: 'bIII', quality: 'Major', isNonDiatonic: true, function: 'Stranger', activeVoicingIdx: 0, description: "THE STRANGER! Uses G Natural (Key has G#). Sounds bluesy.", voicings: [{ name: 'Open', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], notes: ['G2', 'B2', 'D3', 'G3', 'B3', 'G4'] }] },
    ]
  }
};

// --- HELPERS FOR TRANSITION LOGIC ---

const getTransitionInfo = (prev: Chord, next: Chord) => {
  if (!prev || !next) return null;
  
  const p = prev.roman;
  const n = next.roman;

  // Cadences and common movements
  if ((p === 'V' || p === 'V7') && (n === 'I')) return { label: "Perfect Resolution", type: "resolution", icon: <Home size={12} /> };
  if ((p === 'IV') && (n === 'I')) return { label: "Plagal (Amen)", type: "soft-resolution", icon: <Home size={12} /> };
  if ((p === 'V') && (n === 'vi')) return { label: "Surprise!", type: "deceptive", icon: <Zap size={12} /> };
  if ((p === 'I') && (n === 'V')) return { label: "Building Tension", type: "tension", icon: <ArrowRight size={12} /> };
  if ((p === 'I') && (n === 'IV')) return { label: "Departure", type: "adventure", icon: <Map size={12} /> };
  if ((p === 'ii') && (n === 'V')) return { label: "Jazz Turn", type: "movement", icon: <ArrowRight size={12} /> };
  if (prev.isNonDiatonic || next.isNonDiatonic) return { label: "Exotic", type: "exotic", icon: <Sparkles size={12} /> };

  // Default fallback based on function
  if (prev.function === 'Tension' && next.function === 'Home') return { label: "Release", type: "resolution" };
  if (prev.function === 'Home' && next.function === 'Adventure') return { label: "Exploring", type: "adventure" };
  
  return null;
};

const getFunctionColor = (func: ChordFunction) => {
  switch (func) {
    case 'Home': return 'border-cyan-500 shadow-cyan-500/20 bg-cyan-900/20';
    case 'Adventure': return 'border-amber-500 shadow-amber-500/20 bg-amber-900/20';
    case 'Tension': return 'border-rose-500 shadow-rose-500/20 bg-rose-900/20';
    case 'Stranger': return 'border-purple-500 shadow-purple-500/20 bg-purple-900/20';
    default: return 'border-slate-500';
  }
};

const getFunctionBadgeColor = (func: ChordFunction) => {
  switch (func) {
    case 'Home': return 'bg-cyan-500 text-slate-900';
    case 'Adventure': return 'bg-amber-500 text-slate-900';
    case 'Tension': return 'bg-rose-500 text-white';
    case 'Stranger': return 'bg-purple-500 text-white';
    default: return 'bg-slate-500';
  }
};

// --- WEB AUDIO ENGINE ---

const AudioEngine = {
  ctx: null as AudioContext | null,
  
  init: () => {
    if (!AudioEngine.ctx) {
      AudioEngine.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (AudioEngine.ctx.state === 'suspended') {
      AudioEngine.ctx.resume();
    }
  },

  strum: (notes: string[]) => {
    AudioEngine.init();
    if (!AudioEngine.ctx) return;
    
    const now = AudioEngine.ctx.currentTime;
    
    notes.forEach((note, index) => {
      const freq = NOTE_FREQUENCIES[note];
      if (!freq) return;

      const osc = AudioEngine.ctx!.createOscillator();
      const gain = AudioEngine.ctx!.createGain();
      
      osc.type = 'triangle'; // Triangle is good for guitar-ish sound
      osc.frequency.value = freq;
      
      // Envelope
      gain.gain.setValueAtTime(0, now);
      // Strumming effect: delay higher notes slightly for realism
      const strumDelay = index * 0.035; 
      const start = now + strumDelay;
      
      gain.gain.linearRampToValueAtTime(0.25, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 2.5);
      
      osc.connect(gain);
      gain.connect(AudioEngine.ctx!.destination);
      
      osc.start(start);
      osc.stop(start + 2.6);
    });
  }
};

// --- COMPONENTS ---

// 1. Dynamic Fretboard Visualizer
const Fretboard = ({ chord, scaleNotes, showScale }: { chord: Chord | null, scaleNotes: string[], showScale: boolean }) => {
  // If no chord and no scale mode, show placeholder
  if (!chord && !showScale) return (
    <div className="h-60 w-full bg-slate-800 rounded-xl flex flex-col gap-2 items-center justify-center text-slate-500 border border-slate-700">
      <Music size={32} className="opacity-20" />
      <p>Select a chord or toggle "Show Scale"</p>
    </div>
  );

  const voicing = chord ? chord.voicings[chord.activeVoicingIdx] : { frets: [], fingers: [], notes: [], name: '', baseFret: 1 };
  
  // Calculate which fret to start displaying from
  const calculateStartFret = (frets: number[], explicitBase?: number) => {
    if (explicitBase) return explicitBase;
    const playedFrets = frets.filter(f => f > 0);
    if (playedFrets.length === 0) return 1;
    const min = Math.min(...playedFrets);
    return min <= 2 ? 1 : min;
  };

  const startFret = chord ? calculateStartFret(voicing.frets, voicing.baseFret) : 1;
  // Show 5 frets
  const displayFrets = [0, 1, 2, 3, 4].map(offset => startFret + offset);
  
  // Helper to determine fret markers
  const hasDot = (fret: number) => [3, 5, 7, 9, 12, 15].includes(fret);
  const hasDoubleDot = (fret: number) => fret === 12;

  // Helper: Is this fret/string position a "Safe Note" in the scale?
  const isScaleNote = (stringIndex: number, fret: number) => {
     // Standard Tuning: E A D G B E
     const openStrings = ['E', 'A', 'D', 'G', 'B', 'E'];
     // Get open string note
     const openNote = openStrings[5 - stringIndex]; // Map visual top (0) to High E (5 in openStrings list)? No.
     // Let's use standard: 0=High E, 5=Low E
     const standardTuning = ['E', 'B', 'G', 'D', 'A', 'E']; // 0 to 5
     const rootNote = standardTuning[stringIndex];
     
     // Simple chromatic map
     const chromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
     const rootIdx = chromatic.indexOf(rootNote);
     const currentNoteIdx = (rootIdx + fret) % 12;
     const currentNote = chromatic[currentNoteIdx];
     
     return scaleNotes.includes(currentNote);
  };

  return (
    <div className="relative h-60 w-full bg-[#4a3b32] rounded-xl shadow-inner border-4 border-slate-800 overflow-hidden select-none">
      
      {/* Nut (Only visible if starting at fret 1) */}
      {startFret === 1 && (
        <div className="absolute top-0 left-8 h-full w-3 bg-[#e3d6ba] z-10 shadow-lg"></div>
      )}

      {/* Frets */}
      {displayFrets.map((fretNum, i) => (
        <React.Fragment key={fretNum}>
          {/* Fret Wire */}
          <div className="absolute top-0 h-full w-1.5 bg-gray-400 z-0 shadow-sm" style={{ left: `${8 + ((i + 1) * 60)}px` }}></div>
          
          {/* Fret Number Label */}
          {(i === 0 && startFret > 1) || hasDot(fretNum) ? (
            <div className="absolute bottom-1 text-[10px] text-white/40 font-mono" style={{ left: `${8 + (i * 60) + 30}px`, transform: 'translateX(-50%)' }}>
              {fretNum}
            </div>
          ) : null}

          {/* Fretboard Inlay Dots */}
          {hasDot(fretNum) && (
            <div 
              className={`absolute top-1/2 rounded-full bg-[#e3d6ba] opacity-60 transform -translate-y-1/2 -translate-x-1/2 z-0
              ${hasDoubleDot(fretNum) ? 'w-16 h-4 flex gap-4 justify-center bg-transparent' : 'w-4 h-4'}`}
              style={{ left: `${8 + (i * 60) + 30}px` }}
            >
              {hasDoubleDot(fretNum) && (
                <>
                   <div className="w-4 h-4 rounded-full bg-[#e3d6ba]"></div>
                   <div className="w-4 h-4 rounded-full bg-[#e3d6ba]"></div>
                </>
              )}
            </div>
          )}
        </React.Fragment>
      ))}

      {/* Strings */}
      {[0, 1, 2, 3, 4, 5].map((strIndex) => { 
        const thickness = (strIndex + 1); 
        const yPos = 25 + (strIndex * 34);
        
        // Data mapping for Chord
        const dataIndex = 5 - strIndex; // Map visual top (High E) to data index 5
        const fretVal = chord ? voicing.frets[dataIndex] : -99;
        const fingerVal = chord ? voicing.fingers[dataIndex] : 0;
        const fretOffset = fretVal - startFret;
        const isVisible = fretVal >= startFret && fretVal < startFret + 5;

        return (
          <React.Fragment key={strIndex}>
            {/* String Line */}
            <div 
              className="absolute left-0 w-full bg-[#a0a0a0] shadow-sm z-10" 
              style={{ top: `${yPos}px`, height: `${Math.max(1, thickness * 0.6)}px`, opacity: 0.9 }}
            ></div>

            {/* SCALE OVERLAY DOTS */}
            {showScale && (
              <>
                 {/* Check every visible fret for this string */}
                 {[0, 1, 2, 3, 4].map(fOffset => {
                   const actualFret = startFret + fOffset;
                   // Don't show scale dot on nut (0) if we are at startFret 1, handled by open string indicator? 
                   // Let's just show dots on frets 1+. 
                   if (actualFret === 0) return null; // Open strings are handled differently usually

                   if (isScaleNote(strIndex, actualFret)) {
                     // If finger is here, don't show scale dot to avoid clutter, or show behind?
                     const isFingerHere = (fretVal === actualFret);
                     if (!isFingerHere) {
                       return (
                        <div 
                          key={fOffset}
                          className="absolute w-3 h-3 bg-green-500/30 rounded-full z-15 pointer-events-none animate-pulse"
                          style={{ 
                            top: `${yPos - 6}px`, 
                            left: `${8 + (fOffset * 60) + 30}px` 
                          }}
                        ></div>
                       );
                     }
                   }
                   return null;
                 })}
                 {/* Open String Indicator for Scale */}
                 {startFret === 1 && isScaleNote(strIndex, 0) && fretVal !== 0 && (
                    <div className="absolute left-2 w-2 h-2 bg-green-500/40 rounded-full z-20" style={{ top: `${yPos - 4}px` }}></div>
                 )}
              </>
            )}

            {/* CHORD VISUALIZATION */}
            {chord && (
              <>
                {/* Muted/Open Indicators */}
                {startFret === 1 && (
                  <>
                    {fretVal === -1 && (
                      <div className="absolute left-2 text-red-400 font-bold text-sm z-20" style={{ top: `${yPos - 10}px` }}>X</div>
                    )}
                    {fretVal === 0 && (
                      <div className="absolute left-2 text-green-400 font-bold text-sm z-20" style={{ top: `${yPos - 10}px` }}>O</div>
                    )}
                  </>
                )}
                
                {startFret > 1 && fretVal === -1 && (
                   <div className="absolute left-2 text-red-400 font-bold text-sm z-20" style={{ top: `${yPos - 10}px` }}>X</div>
                )}

                {/* Finger Dot */}
                {fretVal > 0 && isVisible && (
                  <div 
                    className="absolute w-8 h-8 bg-blue-500 rounded-full border-2 border-white z-20 flex items-center justify-center text-white font-bold text-sm shadow-lg transition-transform hover:scale-110"
                    style={{ 
                      top: `${yPos - 16}px`, 
                      left: `${8 + (fretOffset * 60) + 30}px` 
                    }}
                  >
                    {fingerVal > 0 ? fingerVal : ''}
                  </div>
                )}
              </>
            )}

          </React.Fragment>
        );
      })}
      
      <div className="absolute bottom-2 right-3 text-white/30 text-xs font-bold uppercase tracking-widest">
        {chord ? voicing.name : (showScale ? 'Scale Overlay Active' : '')}
      </div>
    </div>
  );
};

// 2. Chord Tile Component (Draggable source or simple button)
const ChordTile: React.FC<{ chord: Chord, onClick: () => void, isSelected?: boolean, inPalette?: boolean }> = ({ chord, onClick, isSelected, inPalette }) => {
  const functionColor = inPalette ? getFunctionColor(chord.function) : '';
  const badgeColor = getFunctionBadgeColor(chord.function);

  return (
    <button 
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 transform hover:-translate-y-1
        ${isSelected 
          ? 'ring-2 ring-white scale-105' 
          : 'hover:opacity-90'}
        ${inPalette ? `${functionColor} border` : 'bg-slate-700 border border-slate-600'}
        ${isSelected && inPalette ? 'bg-opacity-40' : 'bg-opacity-20'}
      `}
    >
      <div className="flex justify-between w-full mb-1">
         <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeColor} opacity-80`}>
           {chord.function === 'Stranger' ? '?' : chord.roman}
         </span>
      </div>
      
      <span className="text-2xl font-bold text-white font-display mb-1">{chord.name}</span>
      <span className="text-[10px] text-slate-400 uppercase">{chord.quality}</span>
    </button>
  );
};

// 3. Theory Spectrum Component
const TheorySpectrum = ({ chord, scaleNotes, keyName }: { chord: Chord | null, scaleNotes: string[], keyName: string }) => {
  if (!chord) return (
    <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center h-full min-h-[120px]">
       <p className="text-slate-500 text-sm mb-2">Select a chord to see its DNA</p>
       <div className="flex gap-2 opacity-30">
          {scaleNotes.map(n => (
            <div key={n} className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs">{n}</div>
          ))}
       </div>
    </div>
  );

  const voicing = chord.voicings[chord.activeVoicingIdx];
  const chordNotes = Array.from(new Set(voicing.notes.map(n => getRawNote(n))));

  return (
    <div className="bg-slate-800/80 p-5 rounded-xl border border-slate-700 h-full flex flex-col">
      <div className="flex justify-between items-start mb-4">
         <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
           <Info size={14} /> Why this chord?
         </h3>
         <span className={`text-xs px-2 py-1 rounded-md font-bold ${getFunctionBadgeColor(chord.function)}`}>
           {chord.function}
         </span>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-4">
        <div className="flex justify-between items-center relative">
           <div className="absolute left-0 -top-6 text-[10px] text-slate-500">Key of {keyName} (Safe Notes)</div>
           {scaleNotes.map((note, idx) => (
             <div key={note} className="flex flex-col items-center gap-1 z-10">
               <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${chordNotes.includes(note) 
                    ? 'bg-blue-500 text-white scale-110 shadow-lg shadow-blue-500/40 ring-2 ring-blue-300' 
                    : 'bg-slate-700 text-slate-400'
                  }
               `}>
                 {note}
               </div>
               <span className="text-[9px] text-slate-600">{idx + 1}</span>
             </div>
           ))}
           <div className="absolute top-4 left-0 w-full h-0.5 bg-slate-700 -z-0"></div>
        </div>

        <div className="flex flex-wrap gap-2 justify-center mt-2 p-3 bg-slate-900/50 rounded-lg">
           <span className="text-xs text-slate-500 mr-2 self-center">Chord {chord.name}:</span>
           {chordNotes.map(note => {
             const isInScale = scaleNotes.includes(note);
             return (
               <div key={note} className={`px-3 py-1 rounded-md text-xs font-bold border flex items-center gap-1
                 ${isInScale 
                   ? 'bg-slate-800 border-blue-500/30 text-blue-300' 
                   : 'bg-orange-900/20 border-orange-500/50 text-orange-400'
                 }
               `}>
                 {note}
                 {!isInScale && <span className="text-[10px] ml-1">⚠️</span>}
               </div>
             )
           })}
        </div>
        
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
           {chord.isNonDiatonic 
             ? `Wait! This chord uses ${chordNotes.find(n => !scaleNotes.includes(n))}, which is NOT in the ${keyName} scale. That's why it sounds surprising!`
             : `This chord is "Diatonic". It only uses notes from the ${keyName} scale, so it sounds perfectly at home.`
           }
        </p>
      </div>
    </div>
  );
};

// 4. AI Tutor Box
const TutorPanel = ({ progression }: { progression: Chord[] }) => {
  const [feedback, setFeedback] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (progression.length < 2) {
      setFeedback("Add at least 2 chords to the timeline to get a theory lesson!");
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const chordDetails = progression.map(c => `${c.name} (${c.function})`).join(' -> ');
        
        const prompt = `
          You are a friendly guitar teacher for a 5th grader. 
          Analyze this specific chord progression: ${chordDetails}.
          
          Explain 3 things simply:
          1. The "Mood": How does it feel?
          2. The "Story": Describe the movement.
          3. The "Why": Mention a simple theory concept (like tension/release).
          
          Keep it short (max 3 sentences). Use emojis.
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });
        
        setFeedback(response.text || "I couldn't hear that properly, try again!");
      } catch (e) {
        console.error(e);
        setFeedback("My guitar strings broke! (AI Error). Check API Key.");
      } finally {
        setLoading(false);
      }
    }, 1500); 

    return () => clearTimeout(timer);
  }, [progression]);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3 text-indigo-400">
        <Sparkles size={18} />
        <h3 className="font-bold text-sm uppercase tracking-wider">AI Theory Tutor</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 animate-pulse">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></span>
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-75"></span>
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-150"></span>
            <span className="text-sm">Listening...</span>
          </div>
        ) : (
          <p className="text-slate-200 leading-relaxed text-lg font-display">
            {feedback}
          </p>
        )}
      </div>
    </div>
  );
};


// --- MAIN APP ---

const App = () => {
  const [currentKey, setCurrentKey] = useState<string>('C Major');
  const [progression, setProgression] = useState<Chord[]>([]);
  
  const [selectedChord, setSelectedChord] = useState<Chord | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [showScaleOnFretboard, setShowScaleOnFretboard] = useState(false);
  
  // Handlers
  const handleChordClick = (chord: Chord) => {
    const voicing = chord.voicings[chord.activeVoicingIdx];
    AudioEngine.strum(voicing.notes);
    setSelectedChord(chord);
  };

  const addToProgression = (chord: Chord) => {
    const newChord = { ...chord, id: Date.now() };
    setProgression([...progression, newChord]);
    handleChordClick(newChord);
  };

  const removeFromProgression = (index: number) => {
    const newProg = [...progression];
    if (selectedChord && selectedChord.id === newProg[index].id) {
      setSelectedChord(null);
    }
    newProg.splice(index, 1);
    setProgression(newProg);
  };

  const changeVoicing = (direction: number) => {
    if (!selectedChord) return;
    
    const count = selectedChord.voicings.length;
    const newIdx = (selectedChord.activeVoicingIdx + direction + count) % count;
    
    const updatedChord = { ...selectedChord, activeVoicingIdx: newIdx };
    setSelectedChord(updatedChord);
    
    const voicing = updatedChord.voicings[newIdx];
    AudioEngine.strum(voicing.notes);

    if (selectedChord.id) {
      setProgression(prev => prev.map(c => c.id === selectedChord.id ? updatedChord : c));
    }
  };

  const playProgression = async () => {
    if (isPlaying || progression.length === 0) return;
    setIsPlaying(true);
    
    for (const chord of progression) {
      setSelectedChord(chord); 
      const voicing = chord.voicings[chord.activeVoicingIdx];
      AudioEngine.strum(voicing.notes);
      await new Promise(r => setTimeout(r, 1000));
    }
    
    setIsPlaying(false);
  };

  const clearProgression = () => {
    setProgression([]);
    setIsPlaying(false);
    setSelectedChord(null);
  };

  const currentKeyData = MUSIC_THEORY[currentKey];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 font-display mb-1 flex items-center gap-3">
            <Music className="text-blue-500" /> ChordLab
          </h1>
          <p className="text-slate-400 text-sm">Build progressions, hear them, learn the theory.</p>
        </div>

        <div className="flex items-center gap-3 bg-slate-800 p-1.5 rounded-lg border border-slate-700 overflow-x-auto max-w-full">
          {Object.keys(MUSIC_THEORY).map(keyName => (
            <button
              key={keyName}
              onClick={() => {
                setCurrentKey(keyName);
                setSelectedChord(null);
              }}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-colors whitespace-nowrap ${
                currentKey === keyName 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {keyName}
            </button>
          ))}
        </div>
      </header>

      {/* MAIN WORKSPACE GRID */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* LEFT COLUMN: Controls & Visualization (7/12) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* 1. PROGRESSION BUILDER (The Timeline) */}
          <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700 min-h-[220px] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <ChevronRight size={16} /> Your Song
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={playProgression}
                  disabled={isPlaying || progression.length === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${
                    isPlaying || progression.length === 0
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600 text-slate-900 shadow-lg shadow-green-500/20'
                  }`}
                >
                  {isPlaying ? 'Playing...' : <><Play size={18} fill="currentColor" /> Play All</>}
                </button>
                <button 
                  onClick={clearProgression}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                  title="Clear All"
                >
                  <RotateCcw size={18} />
                </button>
              </div>
            </div>

            {/* Timeline Slots */}
            <div className="flex gap-1 overflow-x-auto pb-6 scrollbar-hide snap-x items-center">
              {progression.length === 0 && (
                <div className="w-full h-32 border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center text-slate-600">
                  <span className="text-sm">Click chords below to add them here</span>
                </div>
              )}
              
              {progression.map((chord, idx) => {
                 const transition = (idx > 0) ? getTransitionInfo(progression[idx-1], chord) : null;
                 
                 return (
                  <React.Fragment key={chord.id || idx}>
                    
                    {/* Transition Badge (Between chords) */}
                    {transition && (
                      <div className="flex flex-col items-center justify-center w-16 px-1 z-10 -ml-2 -mr-2 flex-shrink-0 animate-in fade-in zoom-in duration-300">
                         <div className={`w-6 h-6 rounded-full flex items-center justify-center bg-slate-800 border shadow-sm ${
                           transition.type === 'resolution' ? 'border-cyan-500 text-cyan-500' :
                           transition.type === 'tension' ? 'border-rose-500 text-rose-500' :
                           transition.type === 'adventure' ? 'border-amber-500 text-amber-500' :
                           'border-slate-500 text-slate-400'
                         }`}>
                           {transition.icon || <ArrowRight size={12}/>}
                         </div>
                         <span className="text-[9px] text-slate-400 font-bold mt-1 text-center leading-tight w-full truncate">
                           {transition.label}
                         </span>
                      </div>
                    )}

                    {/* Chord Card */}
                    <div className="relative group flex-shrink-0 snap-center">
                      <div 
                        onClick={() => handleChordClick(chord)}
                        className={`
                          w-28 h-32 bg-slate-800 rounded-xl flex flex-col items-center justify-center border-2 cursor-pointer transition-all hover:-translate-y-1
                          ${selectedChord && selectedChord.id === chord.id ? 'border-white shadow-xl shadow-white/10 scale-105 z-10' : getFunctionColor(chord.function)}
                        `}
                      >
                        {/* Function Badge */}
                        <div className={`absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded ${getFunctionBadgeColor(chord.function)}`}>
                          {chord.function}
                        </div>

                        <span className="text-3xl font-bold font-display mt-2">{chord.name}</span>
                        <span className="text-xs text-slate-400 mt-1">{chord.voicings[chord.activeVoicingIdx].name}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-2">{chord.roman}</span>
                      </div>
                      
                      {/* Remove Button */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeFromProgression(idx); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-20"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </React.Fragment>
                 )
              })}
            </div>
          </div>

           {/* 2. SCALE VISUALIZER */}
           <div className="min-h-[160px]">
             <TheorySpectrum 
                chord={selectedChord} 
                scaleNotes={currentKeyData.scaleNotes} 
                keyName={currentKey} 
             />
           </div>

          {/* 3. CHORD PALETTE */}
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider pl-1">Available Chords ({currentKey})</h2>
              {/* Legend */}
              <div className="flex gap-2 text-[10px]">
                 <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500"></div>Home</div>
                 <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div>Adventure</div>
                 <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"></div>Tension</div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {currentKeyData.chords.map((chord) => (
                <ChordTile 
                  key={chord.name} 
                  chord={chord} 
                  inPalette={true}
                  onClick={() => addToProgression(chord)}
                  isSelected={selectedChord?.name === chord.name && !selectedChord?.id} 
                />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Theory & Details (5/12) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* FRETBOARD */}
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
            <div className="flex justify-between items-end mb-4">
               <div>
                 <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Fretboard View</h2>
                 {selectedChord ? (
                   <p className="text-xs text-blue-400 mt-1">
                     Finger Placement for <span className="text-white font-bold">{selectedChord.name}</span>
                   </p>
                 ) : (
                   <p className="text-xs text-slate-600 mt-1">
                     {showScaleOnFretboard ? "Showing Scale Notes" : "Select a chord"}
                   </p>
                 )}
               </div>
               
               {/* Controls: Voicing + Scale Toggle */}
               <div className="flex gap-2">
                  {selectedChord && selectedChord.voicings.length > 1 && (
                    <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 p-1">
                      <button onClick={() => changeVoicing(-1)} className="p-1 hover:text-blue-400 transition-colors"><ChevronLeft size={16}/></button>
                      <span className="text-xs font-mono px-2 min-w-[60px] text-center text-slate-300">
                        {selectedChord.voicings[selectedChord.activeVoicingIdx].name.split(' ')[0]}...
                      </span>
                      <button onClick={() => changeVoicing(1)} className="p-1 hover:text-blue-400 transition-colors"><ChevronRight size={16}/></button>
                    </div>
                  )}

                  <button 
                    onClick={() => setShowScaleOnFretboard(!showScaleOnFretboard)}
                    className={`p-2 rounded-lg border transition-all ${
                      showScaleOnFretboard 
                        ? 'bg-green-500/20 text-green-400 border-green-500/50' 
                        : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-slate-300'
                    }`}
                    title="Show Safe Notes (Scale)"
                  >
                    {showScaleOnFretboard ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
               </div>
            </div>
            
            <Fretboard 
              chord={selectedChord} 
              scaleNotes={currentKeyData.scaleNotes} 
              showScale={showScaleOnFretboard} 
            />
            
            <div className="mt-4 bg-slate-900/50 p-3 rounded-lg border border-slate-800/50 flex justify-between items-center">
              <p className="text-sm text-slate-400">
                <span className="text-indigo-400 font-bold">Quick Tip:</span> {selectedChord ? selectedChord.description : "Toggle the eye icon to see all safe notes!"}
              </p>
              {selectedChord && <Volume2 size={20} className="text-slate-600 ml-2" />}
            </div>
          </div>

          {/* AI TUTOR */}
          <div className="flex-1 min-h-[250px]">
            <TutorPanel progression={progression} />
          </div>

        </div>
      </main>
    </div>
  );
};

// Root Render
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}