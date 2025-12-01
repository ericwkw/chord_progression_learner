
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Play, Volume2, ArrowRight, X, Music, Info, Sparkles, Settings, RefreshCw, ChevronRight, ChevronLeft, HelpCircle, BookOpen } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// --- AUDIO ENGINE ---
const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
let audioCtx: AudioContext | null = null;

const NOTE_FREQUENCIES: Record<string, number> = {
  'C': 16.35, 'C#': 17.32, 'Db': 17.32, 'D': 18.35, 'D#': 19.45, 'Eb': 19.45,
  'E': 20.60, 'F': 21.83, 'F#': 23.12, 'Gb': 23.12, 'G': 24.50, 'G#': 25.96,
  'Ab': 25.96, 'A': 27.50, 'A#': 29.14, 'Bb': 29.14, 'B': 30.87
};

const getFrequency = (note: string, octave: number) => {
  const base = NOTE_FREQUENCIES[note];
  if (!base) return 0;
  return base * Math.pow(2, octave);
};

const initAudio = () => {
    if (!audioCtx) {
        audioCtx = new AudioContextClass();
    }
    if (audioCtx?.state === 'suspended') {
        audioCtx.resume();
    }
};

const strumChord = (notes: { note: string, octave: number }[]) => {
  initAudio();
  if (!audioCtx) return;
  
  const now = audioCtx.currentTime;
  notes.forEach((n, i) => {
    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();
    
    // Guitar-ish oscillator mix
    osc.type = 'triangle'; // Closer to a plucked string than sine
    
    osc.frequency.value = getFrequency(n.note, n.octave);
    
    // Strumming delay
    const strumDelay = i * 0.035; 
    
    gain.gain.setValueAtTime(0, now + strumDelay);
    gain.gain.linearRampToValueAtTime(0.25, now + strumDelay + 0.05); // Attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + strumDelay + 2.5); // Decay
    
    osc.connect(gain);
    gain.connect(audioCtx!.destination);
    
    osc.start(now + strumDelay);
    osc.stop(now + strumDelay + 3.0);
  });
};

// --- MUSIC THEORY ENGINE ---

const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALE_PATTERNS: Record<string, number[]> = {
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Natural Minor': [0, 2, 3, 5, 7, 8, 10],
  'Melodic Minor (Jazz)': [0, 2, 3, 5, 7, 9, 11], // Jazz Minor: 1 2 b3 4 5 6 7
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Locrian': [0, 1, 3, 5, 6, 8, 10], // 1 b2 b3 4 b5 b6 b7
  'Phrygian': [0, 1, 3, 5, 7, 8, 10],
  'Lydian': [0, 2, 4, 6, 7, 9, 11],
};

const ROMAN_NUMERALS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];

// Offsets from the barre/nut for common shapes
// -1 means mute, numbers are relative fret adds
const CHORD_SHAPES: Record<string, { eShape: number[], aShape: number[] }> = {
    // TRIADS (Fallbacks)
    '': { // Major
        eShape: [0, 2, 2, 1, 0, 0],
        aShape: [-1, 0, 2, 2, 2, 0]
    },
    'm': { // Minor
        eShape: [0, 2, 2, 0, 0, 0],
        aShape: [-1, 0, 2, 2, 1, 0]
    },
    'dim': { // Diminished Triad
        eShape: [0, 1, 2, 0, -1, -1],
        aShape: [-1, 0, 1, 2, 1, -1]
    },
    // 7TH CHORDS (Jazz/Blues Essentials)
    'maj7': {
        // Emaj7 (Shell-ish or Barre): 0 2 1 1 0 0
        eShape: [0, 2, 1, 1, 0, 0], 
        // Amaj7: x 0 2 1 2 0
        aShape: [-1, 0, 2, 1, 2, 0] 
    },
    'm7': {
        // Em7: 0 2 0 0 0 0
        eShape: [0, 2, 0, 0, 0, 0],
        // Am7: x 0 2 0 1 0
        aShape: [-1, 0, 2, 0, 1, 0]
    },
    '7': { // Dominant 7
        // E7: 0 2 0 1 0 0
        eShape: [0, 2, 0, 1, 0, 0],
        // A7: x 0 2 0 2 0
        aShape: [-1, 0, 2, 0, 2, 0]
    },
    'm7b5': { // Half Diminished
        // Em7b5 shape (root on E): 0 1 0 0 -1 -1 (Tricky, using standard Gm7b5 shape shifted: R b5 b7 b3) -> 0 x 0 0 -1 -1 ?
        // Better E-string shape (Root, b7, b3, b5): T x 3 3 2 x (relative to root at T).
        // Let's use: Root(0), b7(0 on D string?? No), let's use the Shell Voicing [0, x, 0, 0, -1, -1] (E, D, G)
        eShape: [0, -1, 0, 0, -1, -1], 
        // Am7b5 shape (root on A): x 0 1 0 1 x (Root, b5, b7, b3) -> x R b5 b7 b3
        aShape: [-1, 0, 1, 0, 1, -1]
    },
    'dim7': { // Full Diminished 7
        // E-dim7: 0 x 0 0 -1 -1 (Shell) or the symetric shape [0, 1, 0, 1, 0, x]?
        // Standard Edim7: 0 1 0 0 -1 -1 (E, Bb, Db, G)
        eShape: [0, 1, 0, 0, -1, -1],
        // Adim7: x 0 1 0 1 x (Same as m7b5 shape physically but different intervals)
        // A(0), Eb(1), Gb(2 on G?? No F#), C(1). Shape: x 0 1 2 1 x
        aShape: [-1, 0, 1, 2, 1, -1]
    }
};

interface Voicing {
  name: string;
  frets: number[]; // 6 strings, -1 for mute, 0 for open
  baseFret?: number; // For rendering positioning
}

interface Chord {
  id: string; // Unique ID for key
  root: string;
  quality: string; // 'm', 'maj', 'dim', '7'
  name: string;
  roman: string;
  function: 'Home' | 'Adventure' | 'Tension' | 'Stranger'; // Functional harmony role
  notes: string[];
  voicings: Voicing[];
  activeVoicingIdx: number;
  scaleDegree: number;
  isDiatonic: boolean;
}

// Guitar tuning: E2, A2, D3, G3, B3, E4
const GUITAR_TUNING = [
  { note: 'E', octave: 2 },
  { note: 'A', octave: 2 },
  { note: 'D', octave: 3 },
  { note: 'G', octave: 3 },
  { note: 'B', octave: 3 },
  { note: 'E', octave: 4 },
];

const getNoteAtFret = (stringIdx: number, fret: number) => {
  if (fret === -1) return null;
  const openNote = GUITAR_TUNING[stringIdx];
  const openNoteIdx = ALL_NOTES.indexOf(openNote.note);
  const totalSemis = openNoteIdx + fret;
  const noteName = ALL_NOTES[totalSemis % 12];
  const octaveBoost = Math.floor(totalSemis / 12);
  return { note: noteName, octave: openNote.octave + octaveBoost };
};

// Helper to shift a shape to a specific root fret
const createVoicingFromShape = (shape: number[], rootFret: number): number[] => {
    return shape.map(f => {
        if (f === -1) return -1;
        let finalFret = f + rootFret;
        // Optimization: prevent voicings from going too high on the neck
        if (finalFret > 12 && shape[0] !== -1 && (shape[0] + rootFret) > 12) {
             finalFret -= 12;
        }
        return finalFret;
    });
};

const getQualityFromIntervals = (third: number, fifth: number, seventh: number): string => {
    // 3rd: 3=min, 4=maj
    // 5th: 6=dim, 7=perf, 8=aug
    // 7th: 9=dim, 10=min, 11=maj

    if (third === 4 && fifth === 7 && seventh === 11) return 'maj7';
    if (third === 4 && fifth === 7 && seventh === 10) return '7'; // Dom7
    if (third === 3 && fifth === 7 && seventh === 10) return 'm7';
    if (third === 3 && fifth === 7 && seventh === 11) return 'mMaj7'; // Jazz Minor I
    if (third === 3 && fifth === 6 && seventh === 10) return 'm7b5'; // Half Dim
    if (third === 3 && fifth === 6 && seventh === 9) return 'dim7'; // Full Dim
    
    // Fallback to Triads if 7th is weird
    if (third === 4 && fifth === 7) return '';
    if (third === 3 && fifth === 7) return 'm';
    if (third === 3 && fifth === 6) return 'dim';
    
    return '';
};

// Generates chords for a specific key
const generateKeyChords = (root: string, scaleType: string): Chord[] => {
  const rootIdx = ALL_NOTES.indexOf(root);
  const pattern = SCALE_PATTERNS[scaleType];
  
  // Get scale notes
  const scaleNotes = pattern.map(interval => ALL_NOTES[(rootIdx + interval) % 12]);
  
  const chords: Chord[] = scaleNotes.map((note, i) => {
    // Build 7th chord (1-3-5-7)
    const thirdNote = scaleNotes[(i + 2) % 7];
    const fifthNote = scaleNotes[(i + 4) % 7];
    const seventhNote = scaleNotes[(i + 6) % 7];
    
    // Analyze quality
    const chordRootVal = ALL_NOTES.indexOf(note);
    const thirdVal = ALL_NOTES.indexOf(thirdNote);
    const fifthVal = ALL_NOTES.indexOf(fifthNote);
    const seventhVal = ALL_NOTES.indexOf(seventhNote);
    
    const thirdInterval = (thirdVal - chordRootVal + 12) % 12;
    const fifthInterval = (fifthVal - chordRootVal + 12) % 12;
    const seventhInterval = (seventhVal - chordRootVal + 12) % 12;
    
    let quality = getQualityFromIntervals(thirdInterval, fifthInterval, seventhInterval);

    // Determine Function
    let func: Chord['function'] = 'Adventure'; 
    if (i === 0) func = 'Home'; // I
    if (i === 4) func = 'Tension'; // V
    if (i === 6) func = 'Tension'; // vii
    if (i === 2 || i === 5) func = 'Home'; // iii, vi (Relative minors)
    if (i === 1 || i === 3) func = 'Adventure'; // ii, IV

    // Special case for Blues/Mixolydian
    if (scaleType === 'Mixolydian' && i === 0) func = 'Home'; // I7
    if (scaleType === 'Mixolydian' && i === 3) func = 'Adventure'; // IV
    if (scaleType === 'Mixolydian' && i === 4) func = 'Tension'; // v minor

    // Roman Numeral
    let roman = ROMAN_NUMERALS[i];
    // Upper case for Major 3rd chords
    if (thirdInterval === 4) roman = roman.toUpperCase();
    
    // Add extension text
    if (quality.includes('7')) roman += '7';
    if (quality === 'maj7') roman = roman.replace('7', 'Maj7');
    if (quality === 'm7b5') roman += 'ø';
    if (quality === 'dim7') roman += '°7';

    // Generate Voicings
    const voicings: Voicing[] = [];
    // Fallback logic: if exact 7th quality not found, fall back to triad shape
    let shapeKey = quality;
    if (!CHORD_SHAPES[shapeKey]) {
        // Fallback mapping
        if (quality === 'mMaj7') shapeKey = 'm7'; // Close enough for visual
        else if (quality.startsWith('m')) shapeKey = 'm';
        else if (quality.startsWith('dim')) shapeKey = 'dim';
        else shapeKey = '';
    }
    const shapeTemplate = CHORD_SHAPES[shapeKey] || CHORD_SHAPES['']; 

    // 1. E-Shape
    const eStringIdx = ALL_NOTES.indexOf('E');
    const eShapeRootFret = (chordRootVal - eStringIdx + 12) % 12; 
    const eFrets = createVoicingFromShape(shapeTemplate.eShape, eShapeRootFret);
    const isEBarre = eFrets.some(f => f > 0) && eShapeRootFret > 0;
    
    voicings.push({
        name: !isEBarre ? "Open / Bottom" : `Root on E (Fret ${eShapeRootFret || 12})`,
        frets: eFrets,
        baseFret: Math.min(...eFrets.filter(f => f !== -1)) || 1
    });

    // 2. A-Shape
    const aStringIdx = ALL_NOTES.indexOf('A');
    const aShapeRootFret = (chordRootVal - aStringIdx + 12) % 12;
    const aFrets = createVoicingFromShape(shapeTemplate.aShape, aShapeRootFret);
    const isABarre = aFrets.some(f => f > 0) && aShapeRootFret > 0;

    voicings.push({
        name: !isABarre ? "Open A-Style" : `Root on A (Fret ${aShapeRootFret || 12})`,
        frets: aFrets,
        baseFret: Math.min(...aFrets.filter(f => f !== -1)) || 1
    });

    return {
      id: `${note}${quality}-${i}`,
      root: note,
      quality,
      name: `${note}${quality}`,
      roman,
      function: func,
      notes: [note, thirdNote, fifthNote, seventhNote],
      voicings: voicings,
      activeVoicingIdx: 0,
      scaleDegree: i + 1,
      isDiatonic: true
    };
  });

  // "Stranger" Chord Logic (Smart Substitution)
  // If Major: bVII7 (Backdoor/Mixolydian)
  // If Minor: bII maj7 (Neapolitan) or V7 (if natural minor)
  
  let strangerIdx, strangerQuality;
  
  if (scaleType.includes('Minor') || scaleType === 'Locrian') {
      // Use the Major V in Minor key (Harmonic context) if not already present
      // Natural Minor v is minor. Let's force a V7.
      strangerIdx = (rootIdx + 7) % 12; // 5th
      strangerQuality = '7'; // Dominant
  } else {
      // Major Key -> bVII7 (Mixolydian flavor / Backdoor dominant)
      strangerIdx = (rootIdx + 10) % 12;
      strangerQuality = '7';
  }

  const sRootNote = ALL_NOTES[strangerIdx];
  const sTemplate = CHORD_SHAPES[strangerQuality];
  
  // Calculate E-Shape for Stranger
  const eStringIdx = ALL_NOTES.indexOf('E');
  const sRootFret = (strangerIdx - eStringIdx + 12) % 12;
  const sFrets = createVoicingFromShape(sTemplate.eShape, sRootFret);

  chords.push({
      id: `stranger-${sRootNote}`,
      root: sRootNote,
      quality: strangerQuality,
      name: `${sRootNote}${strangerQuality}`,
      roman: '?',
      function: 'Stranger',
      notes: [sRootNote, '?', '?', '?'], // Placeholder notes
      voicings: [{ 
          name: 'Mystery Guest', 
          frets: sFrets, 
          baseFret: Math.min(...sFrets.filter(f => f !== -1)) 
      }],
      activeVoicingIdx: 0,
      scaleDegree: 0, 
      isDiatonic: false
  });

  return chords;
};

// --- COMPONENTS ---

const GuideModal = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-cyan-900/20 to-blue-900/20">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          👋 Welcome to ChordLab!
        </h2>
        <p className="text-slate-400 mt-1">Your playground for making songs.</p>
      </div>
      
      <div className="p-8 overflow-y-auto space-y-8">
        
        {/* Section 1: The Key */}
        <div className="flex gap-4">
          <div className="bg-slate-800 p-3 rounded-xl h-fit">
            <Music size={24} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white mb-2">What is a "Key"?</h3>
            <p className="text-slate-300 leading-relaxed">
              Think of a <strong>Key</strong> (like C Major) as a <strong>Team</strong> of notes. 
              The chords you see at the bottom are the players on that team. 
              They always work well together because they share the same DNA!
            </p>
          </div>
        </div>

        {/* Section 2: The Colors */}
        <div className="flex gap-4">
           <div className="bg-slate-800 p-3 rounded-xl h-fit">
            <Sparkles size={24} className="text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white mb-3">The "Jobs" (Colors)</h3>
            <p className="text-slate-300 mb-4">Every chord has a special feeling or "job" in a story:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-lg border border-cyan-500/30">
                <div className="w-4 h-4 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
                <div>
                  <strong className="text-cyan-200 block text-sm">Home</strong>
                  <span className="text-xs text-slate-400">Feels safe. Songs start/end here.</span>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-lg border border-amber-500/30">
                <div className="w-4 h-4 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                <div>
                  <strong className="text-amber-200 block text-sm">Adventure</strong>
                  <span className="text-xs text-slate-400">Leaves home. Exciting!</span>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-lg border border-rose-500/30">
                <div className="w-4 h-4 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
                <div>
                  <strong className="text-rose-200 block text-sm">Tension</strong>
                  <span className="text-xs text-slate-400">Cliffhanger! Wants to go Home.</span>
                </div>
              </div>

               <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-lg border border-purple-500/30">
                <div className="w-4 h-4 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                <div>
                  <strong className="text-purple-200 block text-sm">Stranger</strong>
                  <span className="text-xs text-slate-400">A cool guest. Sounds surprising.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Section 3: How to Play */}
        <div className="flex gap-4">
          <div className="bg-slate-800 p-3 rounded-xl h-fit">
            <BookOpen size={24} className="text-emerald-400" />
          </div>
           <div>
            <h3 className="font-bold text-lg text-white mb-2">How to use this app?</h3>
            <ul className="text-slate-300 space-y-2 list-disc list-inside">
              <li><strong>Click chords</strong> at the bottom to add them to your song.</li>
              <li>Use the <strong>Scale DNA</strong> to see why a chord fits.</li>
              <li>Ask the <strong>AI Tutor</strong> to check your work!</li>
            </ul>
           </div>
        </div>

      </div>

      <div className="p-6 border-t border-slate-800 flex justify-end bg-slate-900">
        <button 
          onClick={onClose}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-cyan-900/50"
        >
          Let's Play! <ArrowRight size={18} />
        </button>
      </div>
    </div>
  </div>
);

const Fretboard = ({ chord, showScale, scaleNotes }: { chord: Chord | null, showScale: boolean, scaleNotes: string[] }) => {
  if (!chord) return <div className="h-48 w-full bg-slate-900/50 rounded-xl flex items-center justify-center text-slate-500">Select a chord to view voicing</div>;
  
  const voicing = chord.voicings[chord.activeVoicingIdx];
  if (!voicing) return <div className="h-48 w-full bg-slate-900/50 rounded-xl flex items-center justify-center text-red-400">Voicing data missing</div>;

  const fretsToShow = 5;
  const startFret = voicing.baseFret || 1;
  const endFret = startFret + fretsToShow;

  // Render Frets
  const renderFrets = () => {
    const lines = [];
    for (let i = 0; i <= fretsToShow; i++) {
      lines.push(
        <div key={i} className="absolute w-full h-px bg-slate-600" style={{ top: `${(i / fretsToShow) * 100}%` }}>
           <span className="absolute -left-6 -top-2 text-xs text-slate-500 font-mono">
             {startFret + i > 0 ? startFret + i : 'Nut'}
           </span>
        </div>
      );
    }
    return lines;
  };

  // Render Strings
  const renderStrings = () => {
    return [0, 1, 2, 3, 4, 5].map(s => (
      <div key={s} className="absolute h-full w-px bg-slate-500" style={{ left: `${10 + (s * 16)}%` }}></div>
    ));
  };

  // Render Fingers
  const renderNotes = () => {
    return voicing.frets.map((fret, stringIdx) => {
      if (fret === -1) return (
         <div key={stringIdx} className="absolute text-slate-600 text-xs font-bold" style={{ top: '-15px', left: `${9 + (stringIdx * 16)}%` }}>X</div>
      );
      
      // Calculate visual position relative to view
      const relativeFret = fret - startFret;
      const isVisible = relativeFret >= 0 && relativeFret < fretsToShow;
      
      if (!isVisible && fret !== 0) return null; // Should adjust view really, but simplest for now

      const topPos = fret === 0 ? -10 : ((relativeFret + 0.5) / fretsToShow) * 100;
      
      const noteInfo = getNoteAtFret(stringIdx, fret);
      const isRoot = noteInfo?.note === chord.root;
      
      return (
        <div 
          key={stringIdx}
          className={`absolute w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm z-10
            ${isRoot ? 'bg-cyan-500 text-white' : 'bg-white text-slate-900'}
          `}
          style={{ 
            top: fret === 0 ? '-12px' : `calc(${topPos}% - 12px)`, 
            left: `calc(${10 + (stringIdx * 16)}% - 12px)` 
          }}
        >
          {noteInfo?.note}
        </div>
      );
    });
  };

  // Render Scale Overlay
  const renderScaleOverlay = () => {
    if (!showScale) return null;
    const dots = [];
    for (let s = 0; s < 6; s++) {
      for (let f = startFret; f < endFret; f++) {
         const noteInfo = getNoteAtFret(s, f);
         if (noteInfo && scaleNotes.includes(noteInfo.note)) {
            // Don't draw over existing chord notes
            if (voicing.frets[s] !== f) {
               const relativeFret = f - startFret;
               const topPos = ((relativeFret + 0.5) / fretsToShow) * 100;
               dots.push(
                 <div 
                   key={`scale-${s}-${f}`}
                   className="absolute w-3 h-3 rounded-full bg-slate-700/50 pointer-events-none"
                   style={{ 
                     top: `calc(${topPos}% - 6px)`, 
                     left: `calc(${10 + (s * 16)}% - 6px)` 
                   }}
                 />
               );
            }
         }
      }
    }
    return dots;
  };

  return (
    <div className="relative w-48 h-64 bg-slate-800 rounded-lg border border-slate-700 mx-auto mt-4 p-4 overflow-hidden shadow-inner">
      <div className="relative w-full h-full">
        {renderFrets()}
        {renderStrings()}
        {renderScaleOverlay()}
        {renderNotes()}
      </div>
    </div>
  );
};

const TheorySpectrum = ({ scaleNotes, currentChord }: { scaleNotes: string[], currentChord: Chord | null }) => {
  return (
    <div className="flex gap-2 justify-center mt-4 flex-wrap">
      {scaleNotes.map((note, i) => {
        const isChordTone = currentChord?.notes.includes(note);
        const isRoot = currentChord?.root === note;
        
        let label = (i + 1).toString();
        const isPrimary = i === 0 || i === 2 || i === 4 || i === 6;
        if (i === 0) label = "Root";
        else if (i === 2) label = "3rd";
        else if (i === 4) label = "5th";
        else if (i === 6) label = "7th";

        return (
          <div key={i} className="flex flex-col items-center gap-2 min-w-[32px]">
            <div className={`
               w-8 h-8 rounded flex items-center justify-center text-xs font-bold border transition-all
               ${isRoot ? 'bg-cyan-500 border-cyan-400 text-white scale-110 shadow-lg shadow-cyan-500/50' : 
                 isChordTone ? 'bg-slate-200 border-slate-200 text-slate-900' : 'bg-slate-800 border-slate-700 text-slate-500'}
            `}>
              {note}
            </div>
            <span className={`text-[10px] font-mono whitespace-nowrap ${isPrimary ? 'text-slate-400 font-bold' : 'text-slate-700'}`}>
               {label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const ChordLegend = () => (
  <div className="flex flex-wrap gap-4 mb-4 px-2 items-center">
    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mr-2">Chord Types:</span>
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]"></div> Home
    </div>
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"></div> Adventure
    </div>
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"></div> Tension
    </div>
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]"></div> Stranger
    </div>
  </div>
);

// --- MAIN APP ---

interface Transition {
  type: 'resolution' | 'tension' | 'adventure' | 'neutral';
  label: string;
  icon?: React.ReactNode;
}

export default function App() {
  const [root, setRoot] = useState('C');
  const [scaleType, setScaleType] = useState('Major');
  const [progression, setProgression] = useState<Chord[]>([]);
  const [selectedChord, setSelectedChord] = useState<Chord | null>(null);
  const [showScale, setShowScale] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);

  // Derived Data
  const keyChords = useMemo(() => generateKeyChords(root, scaleType), [root, scaleType]);
  const scaleNotes = useMemo(() => {
    const idx = ALL_NOTES.indexOf(root);
    return SCALE_PATTERNS[scaleType].map(i => ALL_NOTES[(idx + i) % 12]);
  }, [root, scaleType]);

  const addChord = (chordTemplate: Chord) => {
    // Clone to allow independent voicing changes
    const newChord = { ...chordTemplate, id: `${chordTemplate.id}-${Date.now()}` };
    setProgression([...progression, newChord]);
    setSelectedChord(newChord);
    playSound(newChord);
  };

  const playSound = (chord: Chord) => {
    const voicing = chord.voicings[chord.activeVoicingIdx];
    if (!voicing) return;

    const notesToPlay: {note: string, octave: number}[] = [];
    voicing.frets.forEach((fret, stringIdx) => {
      if (fret !== -1) {
        const note = getNoteAtFret(stringIdx, fret);
        if (note) notesToPlay.push(note);
      }
    });
    // Sort by pitch
    notesToPlay.sort((a,b) => (a.octave * 12 + ALL_NOTES.indexOf(a.note)) - (b.octave * 12 + ALL_NOTES.indexOf(b.note)));
    strumChord(notesToPlay);
  };

  const changeVoicing = (delta: number) => {
    if (!selectedChord) return;
    const idx = progression.findIndex(c => c.id === selectedChord.id);
    if (idx === -1) return;

    const newProg = [...progression];
    const currentIdx = newProg[idx].activeVoicingIdx;
    const len = newProg[idx].voicings.length;
    const newVoicingIdx = (currentIdx + delta + len) % len;
    
    newProg[idx].activeVoicingIdx = newVoicingIdx;
    setProgression(newProg);
    setSelectedChord(newProg[idx]);
    playSound(newProg[idx]);
  };

  const getTransitionInfo = (prev: Chord, curr: Chord): Transition => {
    // Simple Functional Logic
    if (prev.function === 'Tension' && curr.function === 'Home') 
       return { type: 'resolution', label: 'Resolve' };
    if (prev.function === 'Home' && curr.function === 'Tension')
       return { type: 'tension', label: 'Build' };
    if (prev.function === 'Adventure' && curr.function === 'Tension')
       return { type: 'tension', label: 'Push' };
    if (curr.function === 'Stranger')
       return { type: 'adventure', label: 'Surprise' };
    
    return { type: 'neutral', label: 'Flow' };
  };

  const getFunctionColor = (func: string) => {
    switch (func) {
      case 'Home': return 'border-cyan-500 shadow-cyan-900/20';
      case 'Adventure': return 'border-amber-500 shadow-amber-900/20';
      case 'Tension': return 'border-rose-500 shadow-rose-900/20';
      case 'Stranger': return 'border-purple-500 shadow-purple-900/20';
      default: return 'border-slate-700';
    }
  };

  const getFunctionBadgeColor = (func: string) => {
    switch (func) {
      case 'Home': return 'bg-cyan-500 text-white';
      case 'Adventure': return 'bg-amber-500 text-slate-900';
      case 'Tension': return 'bg-rose-500 text-white';
      case 'Stranger': return 'bg-purple-500 text-white';
      default: return 'bg-slate-700 text-slate-300';
    }
  };

  const handleAiAnalyze = async () => {
    if (progression.length < 2) return;
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const prompt = `Analyze this chord progression in the key of ${root} ${scaleType} for a beginner guitar student (5th grade level).
      Progression: ${progression.map(c => c.name).join(' -> ')}.
      Explain why it works in 2 simple sentences. Use emojis.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      setAiFeedback(response.text || "No feedback generated.");
    } catch (e) {
      console.error(e);
      setAiFeedback("Oops, my music brain is offline right now! But your ears are the best judge. 👂🎸");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}

      {/* HEADER & CONTROLS */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
               <Music className="text-white" size={20} />
             </div>
             <div>
               <h1 className="font-bold text-xl tracking-tight">ChordLab</h1>
               <p className="text-xs text-slate-400">Generative Theory Assistant</p>
             </div>
          </div>

          <div className="flex items-center gap-2">
             <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-700">
               <select 
                 value={root} 
                 onChange={(e) => { setRoot(e.target.value); setProgression([]); }}
                 className="bg-slate-800 text-white text-sm font-bold py-1.5 px-3 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
               >
                 {ALL_NOTES.map(n => <option key={n} value={n}>{n}</option>)}
               </select>
               <select 
                 value={scaleType} 
                 onChange={(e) => { setScaleType(e.target.value); setProgression([]); }}
                 className="bg-slate-800 text-white text-sm py-1.5 px-3 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
               >
                 {Object.keys(SCALE_PATTERNS).map(s => <option key={s} value={s}>{s}</option>)}
               </select>
            </div>
            <button 
              onClick={() => setShowGuide(true)}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg border border-slate-700 transition-colors"
              title="Help Guide"
            >
              <HelpCircle size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: VISUALIZER */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Fretboard Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center relative overflow-hidden">
            <div className="flex items-center justify-between w-full mb-2">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Fretboard</h2>
              <button 
                onClick={() => setShowScale(!showScale)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${showScale ? 'bg-cyan-900/50 border-cyan-500/50 text-cyan-300' : 'border-slate-700 text-slate-500'}`}
              >
                {showScale ? 'Hide Scale' : 'Show Scale'}
              </button>
            </div>

            <Fretboard chord={selectedChord} showScale={showScale} scaleNotes={scaleNotes} />
            
            {selectedChord && (
               <div className="flex items-center gap-4 mt-4">
                 <button onClick={() => changeVoicing(-1)} className="p-2 rounded-full hover:bg-slate-800 transition-colors"><ChevronLeft size={16}/></button>
                 <div className="text-center">
                    <div className="text-xs text-slate-500 uppercase font-bold">Voicing</div>
                    <div className="text-sm">{selectedChord.voicings[selectedChord.activeVoicingIdx]?.name}</div>
                 </div>
                 <button onClick={() => changeVoicing(1)} className="p-2 rounded-full hover:bg-slate-800 transition-colors"><ChevronRight size={16}/></button>
               </div>
            )}
          </div>

          {/* Theory Spectrum */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
             <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">Scale DNA</h2>
             <TheorySpectrum scaleNotes={scaleNotes} currentChord={selectedChord} />
             <div className="mt-4 text-center">
               <p className="text-[10px] text-slate-500">
                 The <strong>Root, 3rd, and 5th</strong> are the building blocks of chords in this key.
               </p>
             </div>
          </div>
        </div>

        {/* RIGHT COLUMN: WORKSPACE */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* PROGRESSION TIMELINE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-xl">
             <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                <h3 className="font-bold text-slate-200 flex items-center gap-2">
                  <Play size={16} className="text-cyan-500 fill-cyan-500" /> 
                  Your Song
                </h3>
                <div className="flex gap-2">
                   <button 
                     onClick={() => progression.forEach((c, i) => setTimeout(() => playSound(c), i * 1000))}
                     className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-full transition-colors flex items-center gap-1"
                   >
                     <Volume2 size={12}/> Play All
                   </button>
                   <button 
                     onClick={() => setProgression([])}
                     className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded-full transition-colors"
                   >
                     Clear
                   </button>
                </div>
             </div>
             
             <div className="flex gap-2 overflow-x-auto p-4 scrollbar-hide snap-x items-center min-h-[180px]">
               {progression.length === 0 && (
                 <div className="w-full h-36 border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center text-slate-600">
                   <span className="text-sm">Click chords below to add them here</span>
                 </div>
               )}
               
               {progression.map((chord, idx) => {
                  const transition = (idx > 0) ? getTransitionInfo(progression[idx-1], chord) : null;
                  
                  return (
                   <React.Fragment key={chord.id || idx}>
                     
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

                     <div className="relative group flex-shrink-0 snap-center">
                       <div 
                         onClick={() => { setSelectedChord(chord); playSound(chord); }}
                         className={`
                           w-32 h-36 bg-slate-800 rounded-xl flex flex-col items-center justify-center border-2 cursor-pointer transition-all hover:-translate-y-1
                           ${selectedChord && selectedChord.id === chord.id ? 'border-white shadow-xl shadow-white/10 scale-105 z-10' : getFunctionColor(chord.function)}
                         `}
                       >
                         <div className={`absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded ${getFunctionBadgeColor(chord.function)}`}>
                           {chord.function}
                         </div>

                         <span className="text-3xl font-bold font-display mt-3 text-center px-1">{chord.name}</span>
                         <span className="text-xs text-slate-400 mt-1">{chord.voicings[chord.activeVoicingIdx].name}</span>
                         <span className="text-[10px] text-slate-500 font-mono mt-auto mb-3">{chord.roman}</span>
                       </div>
                       
                       <button 
                         onClick={(e) => { e.stopPropagation(); const newP = [...progression]; newP.splice(idx, 1); setProgression(newP); }}
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

          {/* AI FEEDBACK */}
          {progression.length > 1 && (
            <div className="bg-slate-900/50 border border-indigo-500/30 rounded-xl p-4 flex gap-4 items-start">
               <div className="p-2 bg-indigo-500/20 rounded-lg">
                 <Sparkles className="text-indigo-400" size={20} />
               </div>
               <div className="flex-1">
                 <h4 className="font-bold text-indigo-300 text-sm mb-1">AI Tutor</h4>
                 <p className="text-sm text-slate-300 leading-relaxed">
                   {aiFeedback || "Build a progression to get feedback!"}
                 </p>
               </div>
               <button 
                 onClick={handleAiAnalyze}
                 disabled={isAiLoading}
                 className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
               >
                 {isAiLoading ? <RefreshCw className="animate-spin" size={14}/> : 'Analyze'}
               </button>
            </div>
          )}

          {/* CHORD PALETTE */}
          <div>
            <div className="flex justify-between items-end mb-3 ml-1">
               <h3 className="text-slate-400 font-bold uppercase text-xs tracking-wider">Available Chords (The Safe Team)</h3>
            </div>
            
            <ChordLegend />

            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {keyChords.map((chord) => (
                <button
                  key={chord.id}
                  onClick={() => addChord(chord)}
                  className={`
                    aspect-square rounded-xl flex flex-col items-center justify-center border bg-slate-900 transition-all hover:scale-105 active:scale-95
                    ${getFunctionColor(chord.function)} hover:bg-slate-800
                  `}
                >
                  <span className="text-xl font-bold">{chord.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono mt-1">{chord.roman}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// RENDER APP
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
