
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Play, Volume2, ArrowRight, X, Music, Info, Sparkles, Settings, RefreshCw, ChevronRight, ChevronLeft, HelpCircle, BookOpen, Layers } from 'lucide-react';
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

const MUSIC_STYLES = [
  { id: 'Pop', label: 'Pop / Folk', description: 'Triads & Sus chords' },
  { id: 'Jazz', label: 'Jazz', description: '7ths & Extensions' },
  { id: 'Blues', label: 'Blues', description: 'Dominant Cycles' },
];

const ROMAN_NUMERALS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];

// Offsets from the barre/nut for common shapes
// -1 means mute, numbers are relative fret adds
const CHORD_SHAPES: Record<string, { eShape: number[], aShape: number[] }> = {
    // TRIADS
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
    // SUSPENDED & ADD
    'sus4': {
        // Esus4: 0 2 2 2 0 0
        eShape: [0, 2, 2, 2, 0, 0],
        // Asus4: x 0 2 2 3 0
        aShape: [-1, 0, 2, 2, 3, 0]
    },
    'sus2': {
        // Standard Esus2: 0 2 4 4 0 0 
        eShape: [0, 2, 4, 4, 0, 0], 
        // Asus2: x 0 2 2 0 0
        aShape: [-1, 0, 2, 2, 0, 0]
    },
    'add9': {
        // Eadd9: 0 2 2 1 0 2 (Tricky pinky) or 0 2 4 1 0 0
        eShape: [0, 2, 4, 1, 0, 0],
        // Aadd9: x 0 2 2 2 2 (Barre+pinky) or x 0 2 4 2 0
        aShape: [-1, 0, 2, 4, 2, 0]
    },
    '6': {
        // E6: 0 2 2 1 2 0
        eShape: [0, 2, 2, 1, 2, 0],
        // A6: x 0 2 2 2 2 (F# on top)
        aShape: [-1, 0, 2, 2, 2, 2]
    },
    // 7TH CHORDS
    'maj7': { eShape: [0, 2, 1, 1, 0, 0], aShape: [-1, 0, 2, 1, 2, 0] },
    'm7': { eShape: [0, 2, 0, 0, 0, 0], aShape: [-1, 0, 2, 0, 1, 0] },
    '7': { eShape: [0, 2, 0, 1, 0, 0], aShape: [-1, 0, 2, 0, 2, 0] },
    '7sus4': { 
        // E7sus4: 0 2 0 2 0 0 
        eShape: [0, 2, 0, 2, 0, 0],
        // A7sus4: x 0 2 0 3 0
        aShape: [-1, 0, 2, 0, 3, 0]
    },
    'm7b5': { eShape: [0, -1, 0, 0, -1, -1], aShape: [-1, 0, 1, 0, 1, -1] },
    'dim7': { eShape: [0, 1, 0, 0, -1, -1], aShape: [-1, 0, 1, 2, 1, -1] }
};

// Inversion Shapes: offsets relative to the Bass Note Fret
const INVERSION_SHAPES: Record<string, number[]> = {
    // MAJOR OVER 3rd (e.g. G/B, C/E)
    // E-Bass: Bass(0), Mute, 5th(-2), Root(0), 3rd(+1), Mute
    'Maj_3_E': [0, -1, -2, 0, 1, -1], 
    // A-Bass: Mute, Bass(0), 5th(-2), Root(-2), 3rd(-2), 5th(+1)
    'Maj_3_A': [-1, 0, -2, -2, -2, 1],

    // MINOR OVER 3rd (e.g. Gm/Bb, Am/C)
    // E-Bass: Bass(0), Mute, 5th(-1), Root(+1), b3(+2), Mute
    'Min_3_E': [0, -1, -1, 1, 2, -1],
    // A-Bass: Mute, Bass(0), 5th(-1), Root(-1), b3(-2), Mute
    'Min_3_A': [-1, 0, -1, -1, -2, -1],

    // MAJOR OVER 5th (e.g. A/E, C/G)
    // E-Bass: Bass(0), Root(0), 3rd(+2), 5th(+2), Root(+2), 3rd(0) -- A/E style
    'Maj_5_E': [0, 0, 2, 2, 2, 0],
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
  function: 'Home' | 'Adventure' | 'Tension' | 'Stranger' | 'Spice'; // Functional harmony role
  notes: string[];
  voicings: Voicing[];
  activeVoicingIdx: number;
  scaleDegree: number;
  isDiatonic: boolean;
  category: 'Team' | 'Variation' | 'Wildcard';
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

const createInversionVoicing = (shape: number[], bassFret: number): number[] | null => {
    const frets = shape.map(f => {
        if (f === -1) return -1;
        return f + bassFret;
    });
    // Check validity: No negative frets allowed unless it's open string logic
    if (frets.some(f => f < 0 && f !== -1)) return null;
    return frets;
};

const getQualityFromIntervals = (third: number, fifth: number, seventh: number | null): string => {
    if (seventh !== null) {
      if (third === 4 && fifth === 7 && seventh === 11) return 'maj7';
      if (third === 4 && fifth === 7 && seventh === 10) return '7'; // Dom7
      if (third === 3 && fifth === 7 && seventh === 10) return 'm7';
      if (third === 3 && fifth === 7 && seventh === 11) return 'mMaj7'; // Jazz Minor I
      if (third === 3 && fifth === 6 && seventh === 10) return 'm7b5'; // Half Dim
      if (third === 3 && fifth === 6 && seventh === 9) return 'dim7'; // Full Dim
    }
    // Fallback to Triads
    if (third === 4 && fifth === 7) return '';
    if (third === 3 && fifth === 7) return 'm';
    if (third === 3 && fifth === 6) return 'dim';
    return '';
};

// Generates chords for a specific key and style
const generateKeyChords = (root: string, scaleType: string, style: string): Chord[] => {
  const rootIdx = ALL_NOTES.indexOf(root);
  const pattern = SCALE_PATTERNS[scaleType];
  const scaleNotes = pattern.map(interval => ALL_NOTES[(rootIdx + interval) % 12]);
  
  const allChords: Chord[] = [];

  // 1. DIATONIC TEAM
  scaleNotes.forEach((note, i) => {
    const chordRootVal = ALL_NOTES.indexOf(note);

    let thirdNote = scaleNotes[(i + 2) % 7];
    let fifthNote = scaleNotes[(i + 4) % 7];
    let seventhNote = scaleNotes[(i + 6) % 7];

    let useSevenths = (style === 'Jazz' || style === 'Blues');
    let isBluesDominant = false;

    // Blues Override
    if (style === 'Blues' && (i === 0 || i === 3 || i === 4)) {
       isBluesDominant = true;
       thirdNote = ALL_NOTES[(chordRootVal + 4) % 12];
       seventhNote = ALL_NOTES[(chordRootVal + 10) % 12];
       useSevenths = true;
    }

    const thirdVal = ALL_NOTES.indexOf(thirdNote);
    const fifthVal = ALL_NOTES.indexOf(fifthNote);
    const seventhVal = ALL_NOTES.indexOf(seventhNote);
    
    const thirdInterval = (thirdVal - chordRootVal + 12) % 12;
    const fifthInterval = (fifthVal - chordRootVal + 12) % 12;
    const seventhInterval = (seventhVal - chordRootVal + 12) % 12;
    
    let quality = getQualityFromIntervals(thirdInterval, fifthInterval, useSevenths ? seventhInterval : null);

    // Determine Function
    let func: Chord['function'] = 'Adventure'; 
    if (i === 0) func = 'Home'; // I
    if (i === 4) func = 'Tension'; // V
    if (i === 6) func = 'Tension'; // vii
    if (i === 2 || i === 5) func = 'Home'; // iii, vi
    if (i === 1 || i === 3) func = 'Adventure'; // ii, IV

    if (style === 'Blues' || scaleType === 'Mixolydian') {
       if (i === 0) func = 'Home'; if (i === 3) func = 'Adventure'; if (i === 4) func = 'Tension';
    }

    let roman = ROMAN_NUMERALS[i];
    if (thirdInterval === 4) roman = roman.toUpperCase();
    if (quality.includes('7')) roman += '7';
    if (quality === 'maj7') roman = roman.replace('7', 'Maj7');
    if (quality === 'm7b5') roman += 'ø';
    if (quality === 'dim7') roman += '°7';

    // Build Chord Object
    const buildChord = (q: string, n: string, r: string, f: Chord['function'], cat: Chord['category'], customId: string = '') => {
        const voicings: Voicing[] = [];
        let shapeKey = q;
        if (!CHORD_SHAPES[shapeKey]) {
            if (q === 'mMaj7') shapeKey = 'm7'; 
            else if (q.startsWith('m')) shapeKey = 'm';
            else if (q.startsWith('dim')) shapeKey = 'dim';
            else shapeKey = '';
        }
        const shapeTemplate = CHORD_SHAPES[shapeKey] || CHORD_SHAPES['']; 

        // E-Shape
        const eStringIdx = ALL_NOTES.indexOf('E');
        const eShapeRootFret = (ALL_NOTES.indexOf(n) - eStringIdx + 12) % 12; 
        const eFrets = createVoicingFromShape(shapeTemplate.eShape, eShapeRootFret);
        const isEBarre = eFrets.some(fr => fr > 0) && eShapeRootFret > 0;
        voicings.push({
            name: !isEBarre ? "Open / Bottom" : `Root on E (Fret ${eShapeRootFret || 12})`,
            frets: eFrets,
            baseFret: Math.min(...eFrets.filter(fr => fr !== -1)) || 1
        });

        // A-Shape
        const aStringIdx = ALL_NOTES.indexOf('A');
        const aShapeRootFret = (ALL_NOTES.indexOf(n) - aStringIdx + 12) % 12;
        const aFrets = createVoicingFromShape(shapeTemplate.aShape, aShapeRootFret);
        const isABarre = aFrets.some(fr => fr > 0) && aShapeRootFret > 0;
        voicings.push({
            name: !isABarre ? "Open A-Style" : `Root on A (Fret ${aShapeRootFret || 12})`,
            frets: aFrets,
            baseFret: Math.min(...aFrets.filter(fr => fr !== -1)) || 1
        });

        // --- INVERSIONS ---
        // 1. First Inversion (Bass = 3rd)
        if (q === '' || q === 'm') {
            const isMinor = q === 'm';
            // Find 3rd note fret on E string
            const thirdNoteName = thirdNote; 
            const thirdE_Fret = (ALL_NOTES.indexOf(thirdNoteName) - eStringIdx + 12) % 12;
            const shapeNameE = isMinor ? 'Min_3_E' : 'Maj_3_E';
            const invFretsE = createInversionVoicing(INVERSION_SHAPES[shapeNameE], thirdE_Fret);
            if (invFretsE) {
                voicings.push({
                    name: `/${thirdNoteName} (Bass on E)`,
                    frets: invFretsE,
                    baseFret: Math.min(...invFretsE.filter(fr => fr !== -1)) || 1
                });
            }

            // Find 3rd note fret on A string
            const thirdA_Fret = (ALL_NOTES.indexOf(thirdNoteName) - aStringIdx + 12) % 12;
            const shapeNameA = isMinor ? 'Min_3_A' : 'Maj_3_A';
            const invFretsA = createInversionVoicing(INVERSION_SHAPES[shapeNameA], thirdA_Fret);
            if (invFretsA) {
                voicings.push({
                    name: `/${thirdNoteName} (Bass on A)`,
                    frets: invFretsA,
                    baseFret: Math.min(...invFretsA.filter(fr => fr !== -1)) || 1
                });
            }
        }
        
        // 2. Second Inversion (Bass = 5th)
        if (q === '') {
             const fifthNoteName = fifthNote;
             const fifthE_Fret = (ALL_NOTES.indexOf(fifthNoteName) - eStringIdx + 12) % 12;
             const invFrets5 = createInversionVoicing(INVERSION_SHAPES['Maj_5_E'], fifthE_Fret);
             if (invFrets5) {
                voicings.push({
                    name: `/${fifthNoteName} (Bass on E)`,
                    frets: invFrets5,
                    baseFret: Math.min(...invFrets5.filter(fr => fr !== -1)) || 1
                });
             }
        }

        // Calculate notes for playback
        const cNotes = [n, thirdNote, fifthNote]; 
        
        return {
            id: `${n}${q}-${i}-${customId}`,
            root: n,
            quality: q,
            name: `${n}${q}`,
            roman: r,
            function: f,
            notes: cNotes,
            voicings: voicings,
            activeVoicingIdx: 0,
            scaleDegree: i + 1,
            isDiatonic: true,
            category: cat
        };
    };

    allChords.push(buildChord(quality, note, roman, func, 'Team'));

    // 2. VARIATIONS (Spices)
    // Only generate variations for major/minor chords to keep it musical
    
    // Sus4 & Sus2
    if (quality === '' || quality === '7') { // Major Triad or Dom7
        allChords.push(buildChord('sus4', note, roman + 'sus4', 'Spice', 'Variation', 'sus4'));
        allChords.push(buildChord('sus2', note, roman + 'sus2', 'Spice', 'Variation', 'sus2'));
        if (style === 'Pop') {
            allChords.push(buildChord('add9', note, roman + 'add9', 'Spice', 'Variation', 'add9'));
        }
        if (quality === '') { // Plain Major
             allChords.push(buildChord('6', note, roman + '6', 'Spice', 'Variation', '6'));
        }
    }
    
    if (quality === '7') { // Dom7 specific
        allChords.push(buildChord('7sus4', note, roman + '7sus', 'Tension', 'Variation', '7sus4'));
    }
  });

  // 3. WILDCARDS (Happy Accidents / Borrowed Chords)
  const addWildcard = (degreeOffset: number, quality: string, roman: string, label: string) => {
     const wIdx = (rootIdx + degreeOffset) % 12;
     const wNote = ALL_NOTES[wIdx];
     
     // Build Voicing for Wildcard
     const shapeKey = quality;
     const template = CHORD_SHAPES[shapeKey] || CHORD_SHAPES[''];
     const eStringIdx = ALL_NOTES.indexOf('E');
     const wRootFret = (wIdx - eStringIdx + 12) % 12;
     const wFrets = createVoicingFromShape(template.eShape, wRootFret);

     allChords.push({
        id: `wild-${wNote}${quality}`,
        root: wNote,
        quality: quality,
        name: `${wNote}${quality}`,
        roman: roman,
        function: 'Stranger',
        notes: [wNote, '?', '?'],
        voicings: [{ name: label, frets: wFrets, baseFret: Math.min(...wFrets.filter(f => f !== -1)) }],
        activeVoicingIdx: 0,
        scaleDegree: 0,
        isDiatonic: false,
        category: 'Wildcard'
     });
  };

  if (scaleType === 'Major' || scaleType === 'Mixolydian') {
      addWildcard(10, '', 'bVII', 'Mixolydian Borrow'); // bVII Major
      addWildcard(3, '', 'bIII', 'Chromatic Mediant'); // bIII Major
      addWildcard(5, 'm', 'iv', 'Minor Plagal'); // iv Minor
      addWildcard(8, '', 'bVI', 'Epic Lift'); // bVI Major
  } else { // Minor Contexts
      addWildcard(7, '', 'V', 'Major V (Harmonic)'); // V Major
      addWildcard(5, '', 'IV', 'Dorian IV'); // IV Major
      addWildcard(1, '', 'bII', 'Neapolitan'); // bII Major
  }

  return allChords;
};

// --- COMPONENTS ---

const GuideModal = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-cyan-900/20 to-blue-900/20">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          👋 Welcome to ChordLab
        </h2>
        <p className="text-slate-400 mt-1">Generative Theory Assistant & Progression Builder</p>
      </div>
      
      <div className="p-8 overflow-y-auto space-y-8">
        
        <div className="flex gap-4">
          <div className="bg-slate-800 p-3 rounded-xl h-fit">
            <Music size={24} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white mb-2">Chord Categories</h3>
            <p className="text-slate-300 leading-relaxed mb-4">
               We organized available chords into three functional groups:
            </p>
            <ul className="space-y-3">
               <li className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-cyan-500 mt-2"></div>
                  <div><strong className="text-cyan-200">Diatonic (Key Center)</strong>: Chords naturally derived from the selected scale. Safe & consonant.</div>
               </li>
               <li className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-pink-400 mt-2"></div>
                  <div><strong className="text-pink-300">Extensions & Suspensions</strong>: Variations (Sus4, Add9, 6ths) that add color and movement without changing the harmonic function.</div>
               </li>
               <li className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mt-2"></div>
                  <div><strong className="text-purple-300">Borrowed (Modal Interchange)</strong>: Non-diatonic chords borrowed from parallel modes. Use these for "happy accidents" or unexpected modulation.</div>
               </li>
            </ul>
          </div>
        </div>

         <div className="flex gap-4">
           <div className="bg-slate-800 p-3 rounded-xl h-fit">
            <Sparkles size={24} className="text-amber-400" />
          </div>
           <div>
             <h3 className="font-bold text-lg text-white mb-2">Functional Harmony</h3>
             <p className="text-slate-300">The border colors represent the harmonic role of the chord:</p>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-500"></div> Tonic (Home)</div>
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div> Subdominant (Adventure)</div>
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-500"></div> Dominant (Tension)</div>
              </div>
           </div>
         </div>
      </div>

      <div className="p-6 border-t border-slate-800 flex justify-end bg-slate-900">
        <button 
          onClick={onClose}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-cyan-900/50"
        >
          Start Creating <ArrowRight size={18} />
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
  const renderStrings = () => {
    return [0, 1, 2, 3, 4, 5].map(s => (
      <div key={s} className="absolute h-full w-px bg-slate-500" style={{ left: `${10 + (s * 16)}%` }}></div>
    ));
  };
  const renderNotes = () => {
    return voicing.frets.map((fret, stringIdx) => {
      if (fret === -1) return (
         <div key={stringIdx} className="absolute text-slate-600 text-xs font-bold" style={{ top: '-15px', left: `${9 + (stringIdx * 16)}%` }}>X</div>
      );
      const relativeFret = fret - startFret;
      const isVisible = relativeFret >= 0 && relativeFret < fretsToShow;
      if (!isVisible && fret !== 0) return null; 
      const topPos = fret === 0 ? -10 : ((relativeFret + 0.5) / fretsToShow) * 100;
      const noteInfo = getNoteAtFret(stringIdx, fret);
      const isRoot = noteInfo?.note === chord.root;
      return (
        <div 
          key={stringIdx}
          className={`absolute w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm z-10
            ${isRoot ? 'bg-cyan-500 text-white' : 'bg-white text-slate-900'}
          `}
          style={{ top: fret === 0 ? '-12px' : `calc(${topPos}% - 12px)`, left: `calc(${10 + (stringIdx * 16)}% - 12px)` }}
        >
          {noteInfo?.note}
        </div>
      );
    });
  };
  const renderScaleOverlay = () => {
    if (!showScale) return null;
    const dots = [];
    for (let s = 0; s < 6; s++) {
      for (let f = startFret; f < endFret; f++) {
         const noteInfo = getNoteAtFret(s, f);
         if (noteInfo && scaleNotes.includes(noteInfo.note)) {
            if (voicing.frets[s] !== f) {
               const relativeFret = f - startFret;
               const topPos = ((relativeFret + 0.5) / fretsToShow) * 100;
               dots.push(<div key={`scale-${s}-${f}`} className="absolute w-3 h-3 rounded-full bg-slate-700/50 pointer-events-none" style={{ top: `calc(${topPos}% - 6px)`, left: `calc(${10 + (s * 16)}% - 6px)` }}/>);
            }
         }
      }
    }
    return dots;
  };
  return (
    <div className="relative w-full max-w-[320px] h-64 bg-slate-800 rounded-lg border border-slate-700 mx-auto mt-4 p-4 overflow-hidden shadow-inner">
      <div className="relative w-full h-full">
        {renderFrets()}{renderStrings()}{renderScaleOverlay()}{renderNotes()}
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
        if (i === 0) label = "Root"; else if (i === 2) label = "3rd"; else if (i === 4) label = "5th"; else if (i === 6) label = "7th";
        return (
          <div key={i} className="flex flex-col items-center gap-2 min-w-[32px]">
            <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold border transition-all ${isRoot ? 'bg-cyan-500 border-cyan-400 text-white scale-110 shadow-lg shadow-cyan-500/50' : isChordTone ? 'bg-slate-200 border-slate-200 text-slate-900' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>{note}</div>
            <span className={`text-[10px] font-mono whitespace-nowrap ${isPrimary ? 'text-slate-400 font-bold' : 'text-slate-700'}`}>{label}</span>
          </div>
        );
      })}
    </div>
  );
};

const ChordLegend = () => (
  <div className="flex flex-wrap gap-4 mb-4 px-2 items-center">
    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mr-2">Functions:</span>
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]"></div> Tonic
    </div>
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"></div> Subdominant
    </div>
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"></div> Dominant
    </div>
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <div className="w-3 h-3 rounded-full bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.4)]"></div> Extension
    </div>
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]"></div> Borrowed
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
  const [style, setStyle] = useState('Pop');
  const [progression, setProgression] = useState<Chord[]>([]);
  const [selectedChord, setSelectedChord] = useState<Chord | null>(null);
  const [showScale, setShowScale] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);

  // Derived Data
  const allChords = useMemo(() => generateKeyChords(root, scaleType, style), [root, scaleType, style]);
  
  // Group chords for display
  const teamChords = allChords.filter(c => c.category === 'Team');
  const variationChords = allChords.filter(c => c.category === 'Variation');
  const wildcardChords = allChords.filter(c => c.category === 'Wildcard');

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
    if (curr.function === 'Stranger' || curr.category === 'Wildcard')
       return { type: 'adventure', label: 'Surprise' };
    
    return { type: 'neutral', label: 'Flow' };
  };

  const getFunctionColor = (func: string) => {
    switch (func) {
      case 'Home': return 'border-cyan-500 shadow-cyan-900/20';
      case 'Adventure': return 'border-amber-500 shadow-amber-900/20';
      case 'Tension': return 'border-rose-500 shadow-rose-900/20';
      case 'Stranger': return 'border-purple-500 shadow-purple-900/20';
      case 'Spice': return 'border-pink-400 shadow-pink-900/20';
      default: return 'border-slate-700';
    }
  };

  const getFunctionBadgeColor = (func: string) => {
    switch (func) {
      case 'Home': return 'bg-cyan-500 text-white';
      case 'Adventure': return 'bg-amber-500 text-slate-900';
      case 'Tension': return 'bg-rose-500 text-white';
      case 'Stranger': return 'bg-purple-500 text-white';
      case 'Spice': return 'bg-pink-400 text-slate-900';
      default: return 'bg-slate-700 text-slate-300';
    }
  };

  const handleAiAnalyze = async () => {
    if (progression.length < 2) return;
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const prompt = `Analyze this chord progression in the key of ${root} ${scaleType} for an intermediate guitar student.
      Progression: ${progression.map(c => c.name).join(' -> ')}.
      Musical Style: ${style}.
      Explain the functional harmony and voice leading. Brief & concise.`;
      
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
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
               <Music className="text-white" size={20} />
             </div>
             <div>
               <h1 className="font-bold text-xl tracking-tight">ChordLab</h1>
               <p className="text-xs text-slate-400">Generative Theory Assistant</p>
             </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2">
             
             {/* STYLE SELECTOR */}
             <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 mr-2">
                {MUSIC_STYLES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setStyle(s.id); setProgression([]); }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      style === s.id ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                    title={s.description}
                  >
                    {s.label}
                  </button>
                ))}
             </div>

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

      <div className="flex-1 max-w-7xl mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
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
                    <div className="text-xs text-slate-500 uppercase font-bold">Current Voicing</div>
                    <div className="text-sm">{selectedChord.voicings[selectedChord.activeVoicingIdx]?.name}</div>
                 </div>
                 <button onClick={() => changeVoicing(1)} className="p-2 rounded-full hover:bg-slate-800 transition-colors"><ChevronRight size={16}/></button>
               </div>
            )}
          </div>

          {/* Theory Spectrum */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
             <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">Interval Map</h2>
             <TheorySpectrum scaleNotes={scaleNotes} currentChord={selectedChord} />
             <div className="mt-4 text-center">
               <p className="text-[10px] text-slate-500">
                 Highlighted notes show the construction of the active chord relative to the key.
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
                  Progression
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
                   <span className="text-sm">Tap chords below to start building your progression</span>
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
                 <h4 className="font-bold text-indigo-300 text-sm mb-1">AI Analyst</h4>
                 <p className="text-sm text-slate-300 leading-relaxed">
                   {aiFeedback || "Build a progression to analyze functional harmony and voice leading."}
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
          <div className="space-y-6">
            <ChordLegend />

            {/* TEAM SECTION */}
            <div>
               <h3 className="text-cyan-400 font-bold uppercase text-xs tracking-wider mb-2 flex items-center gap-2"><Layers size={14}/> Diatonic Chords (Key Center)</h3>
               <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                 {teamChords.map((chord) => (
                   <button
                     key={chord.id}
                     onClick={() => addChord(chord)}
                     className={`
                       aspect-square rounded-xl flex flex-col items-center justify-center border bg-slate-900 transition-all hover:scale-105 active:scale-95
                       ${getFunctionColor(chord.function)} hover:bg-slate-800
                     `}
                   >
                     <span className="text-xl font-bold text-center leading-tight">{chord.name}</span>
                     <span className="text-[10px] text-slate-500 font-mono mt-1">{chord.roman}</span>
                   </button>
                 ))}
               </div>
            </div>

            {/* VARIATIONS SECTION */}
            {variationChords.length > 0 && (
                <div>
                <h3 className="text-pink-400 font-bold uppercase text-xs tracking-wider mb-2 flex items-center gap-2"><Sparkles size={14}/> Extensions & Suspensions</h3>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {variationChords.map((chord) => (
                    <button
                        key={chord.id}
                        onClick={() => addChord(chord)}
                        className={`
                        aspect-square rounded-xl flex flex-col items-center justify-center border bg-slate-900 transition-all hover:scale-105 active:scale-95
                        ${getFunctionColor(chord.function)} hover:bg-slate-800
                        `}
                    >
                        <span className="text-lg font-bold text-center leading-tight">{chord.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono mt-1">{chord.quality}</span>
                    </button>
                    ))}
                </div>
                </div>
            )}

            {/* WILDCARDS SECTION */}
             <div>
               <h3 className="text-purple-400 font-bold uppercase text-xs tracking-wider mb-2 flex items-center gap-2"><Settings size={14}/> Borrowed Chords (Modal Interchange)</h3>
               <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                 {wildcardChords.map((chord) => (
                   <button
                     key={chord.id}
                     onClick={() => addChord(chord)}
                     className={`
                       aspect-square rounded-xl flex flex-col items-center justify-center border bg-slate-900 transition-all hover:scale-105 active:scale-95
                       border-purple-500 shadow-purple-900/20 hover:bg-slate-800
                     `}
                   >
                     <span className="text-lg font-bold text-center leading-tight">{chord.name}</span>
                     <span className="text-[9px] text-slate-500 font-mono mt-1 text-center px-1">{chord.roman}</span>
                   </button>
                 ))}
               </div>
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
