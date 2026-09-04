
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import './src/index.css';
import { Play, Volume2, ArrowRight, X, Music, Info, Sparkles, Settings, RefreshCw, ChevronRight, ChevronLeft, HelpCircle, BookOpen, Layers } from 'lucide-react';
import { analyzeProgression } from './src/services/ai';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { strumChord } from './src/engine/audio';
import {
  loadProgression,
  saveProgression,
  restoreChords,
  templateIdOf,
  hasSeenGuide,
  markGuideSeen,
} from './src/services/persistence';
import {
  ROOT_OPTIONS,
  SCALE_PATTERNS,
  MUSIC_STYLES,
  getNoteAtFret,
  spellNoteInKey,
  generateKeyChords,
  type Chord,
  type Voicing,
} from './src/engine/theory';
import { noteToPc, spellScale } from './src/engine/notes';

// Monotonic id source for chords added to the progression — unique even when
// several chords are added within the same millisecond.
let chordSeq = 0;
const nextChordSeq = () => ++chordSeq;

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
        
        {/* SECTION 1: GROUPS */}
        <div className="flex gap-4">
          <div className="bg-slate-800 p-3 rounded-xl h-fit">
            <Music size={24} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white mb-2">Chord Groups</h3>
            <p className="text-slate-300 leading-relaxed mb-4">
               We organized chords into three buckets to help you choose:
            </p>
            <ul className="space-y-3">
               <li className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-cyan-500 mt-2"></div>
                  <div><strong className="text-cyan-200">Diatonic (The Team)</strong>: Chords that live in the key. They always sound "correct" together.</div>
               </li>
               <li className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-pink-400 mt-2"></div>
                  <div><strong className="text-pink-300">Extensions (Spice)</strong>: Variations like "sus" or "add9". Same root note, different flavor.</div>
               </li>
               <li className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mt-2"></div>
                  <div><strong className="text-purple-300">Borrowed (Wildcards)</strong>: Chords from other keys. Use these for a cool surprise!</div>
               </li>
            </ul>
          </div>
        </div>

         {/* SECTION 2: GLOSSARY */}
         <div className="flex gap-4">
          <div className="bg-slate-800 p-3 rounded-xl h-fit">
            <BookOpen size={24} className="text-pink-400" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white mb-2">Chord Types Cheat Sheet</h3>
            <div className="space-y-4 text-sm text-slate-300">
              <div>
                <strong className="text-white block mb-1">sus (Suspended):</strong> 
                Imagine holding your breath. These chords replace the stable middle note with a neighbor (2nd or 4th). They sound "floating" and want to resolve back to a normal chord.
              </div>
              <div>
                <strong className="text-white block mb-1">add9:</strong> 
                Like putting a cherry on top. It's a standard chord with one extra high note added for sparkle. Very popular in Pop music.
              </div>
              <div>
                <strong className="text-white block mb-1">7 (Dominant 7th):</strong> 
                The "Blues" sound. It adds a tension note that pulls strongly to the next chord.
              </div>
              <div>
                <strong className="text-white block mb-1">maj7 (Major 7th):</strong> 
                The "Jazz/Lo-Fi" sound. It feels dreamy, soft, and nostalgic.
              </div>
              <div>
                <strong className="text-white block mb-1">Slash Chords (e.g., C/E):</strong> 
                The chord is C, but the bass plays E. It helps connect chords smoothly, like walking down a ramp instead of taking stairs.
              </div>
            </div>
          </div>
        </div>

         {/* SECTION 3: COLORS */}
         <div className="flex gap-4">
           <div className="bg-slate-800 p-3 rounded-xl h-fit">
            <Sparkles size={24} className="text-amber-400" />
          </div>
           <div>
             <h3 className="font-bold text-lg text-white mb-2">The Colors (Roles)</h3>
             <p className="text-slate-300 mb-2">Every chord has a job in the story:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-500"></div> <span><strong>Tonic:</strong> Home base. Feels finished.</span></div>
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div> <span><strong>Subdominant:</strong> Going on an adventure.</span></div>
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-500"></div> <span><strong>Dominant:</strong> Tension! Wants to go Home.</span></div>
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
  const startFret = voicing.baseFret ?? 1;
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
      const isRoot = noteInfo?.pc === chord.rootPc;
      return (
        <div 
          key={stringIdx}
          className={`absolute w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm z-10
            ${isRoot ? 'bg-cyan-500 text-white' : 'bg-white text-slate-900'}
          `}
          style={{ top: fret === 0 ? '-12px' : `calc(${topPos}% - 12px)`, left: `calc(${10 + (stringIdx * 16)}% - 12px)` }}
        >
          {noteInfo ? spellNoteInKey(noteInfo.pc, scaleNotes) : null}
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
         if (noteInfo && scaleNotes.some(n => noteToPc(n) === noteInfo.pc)) {
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
    <div className="relative w-full max-w-[220px] h-64 bg-slate-800 rounded-lg border border-slate-700 mx-auto mt-4 pl-10 pr-4 py-4 overflow-hidden shadow-inner">
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
  const [savedState] = useState(() => loadProgression());
  const [root, setRoot] = useState(savedState?.root ?? 'C');
  const [scaleType, setScaleType] = useState(savedState?.scaleType ?? 'Major');
  const [style, setStyle] = useState(savedState?.style ?? 'Pop');
  const [progression, setProgression] = useState<Chord[]>([]);
  const [selectedChord, setSelectedChord] = useState<Chord | null>(null);
  const [showScale, setShowScale] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(() => !hasSeenGuide());
  const restoredRef = useRef(false);

  // Derived Data
  const allChords = useMemo(() => generateKeyChords(root, scaleType, style), [root, scaleType, style]);
  
  // Group chords for display
  const teamChords = allChords.filter(c => c.category === 'Team');
  const variationChords = allChords.filter(c => c.category === 'Variation');
  const wildcardChords = allChords.filter(c => c.category === 'Wildcard');

  const scaleNotes = useMemo(
    () => spellScale(root, SCALE_PATTERNS[scaleType]),
    [root, scaleType],
  );

  // Restore a saved progression once, against the initial palette.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (savedState?.chords.length) {
      const restored = restoreChords(savedState.chords, allChords, nextChordSeq);
      if (restored.length) {
        setProgression(restored);
        setSelectedChord(restored[restored.length - 1]);
      }
    }
  }, [allChords]);

  // Persist the working state (compact descriptor only). The key selection is
  // saved even with an empty progression so it survives a refresh.
  useEffect(() => {
    if (!restoredRef.current) return;
    saveProgression({
      root,
      scaleType,
      style,
      chords: progression.map(c => ({
        templateId: templateIdOf(c.id),
        activeVoicingIdx: c.activeVoicingIdx,
      })),
    });
  }, [progression, root, scaleType, style]);

  const addChord = (chordTemplate: Chord) => {
    // Clone to allow independent voicing changes
    const newChord = { ...chordTemplate, id: `${chordTemplate.id}-${nextChordSeq()}` };
    setProgression([...progression, newChord]);
    setSelectedChord(newChord);
    playSound(newChord);
  };

  const playSound = (chord: Chord) => {
    const voicing = chord.voicings[chord.activeVoicingIdx];
    if (!voicing) return;

    const notesToPlay: { pc: number, octave: number }[] = [];
    voicing.frets.forEach((fret, stringIdx) => {
      if (fret !== -1) {
        const note = getNoteAtFret(stringIdx, fret);
        if (note) notesToPlay.push(note);
      }
    });
    // Sort low to high so the strum ascends.
    notesToPlay.sort((a, b) => (a.octave * 12 + a.pc) - (b.octave * 12 + b.pc));
    strumChord(notesToPlay);
  };

  const changeVoicing = (delta: number) => {
    if (!selectedChord) return;
    const idx = progression.findIndex(c => c.id === selectedChord.id);
    if (idx === -1) return;

    const current = progression[idx];
    const len = current.voicings.length;
    const newVoicingIdx = (current.activeVoicingIdx + delta + len) % len;

    const updated = { ...current, activeVoicingIdx: newVoicingIdx };
    const newProg = progression.map((c, i) => (i === idx ? updated : c));
    setProgression(newProg);
    setSelectedChord(updated);
    playSound(updated);
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
      const feedback = await analyzeProgression({
        root,
        scaleType,
        style,
        chordNames: progression.map(c => c.name),
      });
      setAiFeedback(feedback);
    } catch (e) {
      console.error(e);
      setAiFeedback("Oops, my music brain is offline right now! But your ears are the best judge. 👂🎸");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      
      {showGuide && <GuideModal onClose={() => { setShowGuide(false); markGuideSeen(); }} />}

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
                 {ROOT_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
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
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
