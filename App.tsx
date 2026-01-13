
import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { GoogleGenAI, Modality, LiveServerMessage, Blob } from '@google/genai';
import { AppStage, CausalGraphData, Source, ChatMessage, SimulationResult, StructuredReport, VerificationCheck } from './types';
import { 
  extractCausalScaffold, 
  runSynthesis, 
  generateReviewerReport, 
  expandCausalNode, 
  runVerificationGates, 
  chatWithNotebook, 
  generateNotebookSummary, 
  speakText, 
  editScientificImage 
} from './services/gemini';
import CausalView from './components/CausalView';
import SynthesisView from './components/SynthesisView';
import ReportView from './components/ReportView';
import { 
  Plus, BookOpen, FileText, Globe, Image as ImageIcon, Send, Mic, 
  Sparkles, BrainCircuit, Activity, Zap, Beaker, ChevronRight, Users, 
  Wifi, Share2, Loader2, Volume2, Info, X, Check, Search, Rocket, MessageSquare,
  Circle, Terminal, FilePlus, Link, Type as TypeIcon, MicOff
} from 'lucide-react';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'];

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export default function App() {
  const [stage, setStage] = useState<AppStage>(AppStage.NOTEBOOK);
  const [sources, setSources] = useState<Source[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  
  // Voice Dictation State
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Modals
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [newSourceData, setNewSourceData] = useState({ title: '', content: '', type: 'text' as 'text' | 'url' });

  // Collaborative State
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [roomID, setRoomID] = useState<string>('');

  // Mechanistic data
  const [scaffold, setScaffold] = useState<CausalGraphData | null>(null);
  const [synthesis, setSynthesis] = useState<SimulationResult | null>(null);
  const [report, setReport] = useState<StructuredReport | null>(null);
  const [notebookSummary, setNotebookSummary] = useState('');

  // Yjs Setup
  const ydoc = useMemo(() => new Y.Doc(), []);
  const ySources = useMemo(() => ydoc.getArray<Source>('sources'), [ydoc]);
  const yScaffold = useMemo(() => ydoc.getMap('scaffold'), [ydoc]);
  const myID = useMemo(() => `scientist_${Math.floor(Math.random() * 10000)}`, []);

  useEffect(() => {
    let hash = window.location.hash.substring(1);
    if (!hash) {
      hash = Math.random().toString(36).substring(7);
      window.location.hash = hash;
    }
    setRoomID(hash);

    const provider = new WebrtcProvider(`proofsmith-notebook-${hash}`, ydoc);
    const { awareness } = provider;

    awareness.setLocalStateField('user', {
      id: myID,
      name: `Researcher ${myID.split('_')[1]}`,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    });

    const syncSources = () => setSources(ySources.toArray());
    const syncScaffold = () => {
      const data = yScaffold.get('data') as CausalGraphData | null;
      if (data) setScaffold(data);
    };

    ySources.observe(syncSources);
    yScaffold.observe(syncScaffold);
    
    // Initial sync
    syncSources();
    syncScaffold();

    awareness.on('change', () => {
      const states = Array.from(awareness.getStates().values());
      setActiveUsers(states.map((s: any) => s.user).filter(Boolean));
    });

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [ydoc, myID, ySources, yScaffold]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  // Speech Recognition Implementation
  const handleToggleDictation = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Voice dictation is not supported in this browser.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        setCurrentInput(transcript);
      };

      recognition.onerror = (event: any) => {
        setIsRecording(false);
        const error = event.error;
        if (error === 'not-allowed') showToast("Microphone permission denied.");
        else if (error === 'no-speech') showToast("No speech was detected.");
        else if (error === 'network') showToast("Network error detected during transcription.");
        else if (error === 'aborted') return;
        else showToast(`Dictation Error: ${error}`);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      showToast("Failed to initialize speech recognition.");
    }
  };

  const handleCreateSource = async () => {
    if (!newSourceData.title || !newSourceData.content) return;
    
    const newSource: Source = { 
      id: Math.random().toString(36).substring(7), 
      type: newSourceData.type, 
      title: newSourceData.title, 
      content: newSourceData.content 
    };
    
    ySources.push([newSource]);
    showToast(`Source added: ${newSource.title}`);
    setIsAddSourceOpen(false);
    setNewSourceData({ title: '', content: '', type: 'text' });

    // If it's the first source, try to scaffold the model automatically
    if (sources.length === 0) {
      setLoading(true);
      try {
        const s = await generateNotebookSummary([newSource]);
        setNotebookSummary(s);
        const sc = await extractCausalScaffold(newSource.content);
        yScaffold.set('data', sc);
      } catch (e) {
        showToast("Initial analysis failed.");
      } finally { setLoading(false); }
    }
  };

  const handleSendMessage = async () => {
    if (!currentInput || sources.length === 0) {
      if (sources.length === 0) showToast("Add a source before chatting.");
      return;
    }

    const userMsg: ChatMessage = { role: 'user', text: currentInput };
    setChatHistory(prev => [...prev, userMsg]);
    setCurrentInput('');
    setLoading(true);

    try {
      const response = await chatWithNotebook(userMsg.text, sources, chatHistory, isThinking);
      setChatHistory(prev => [...prev, response]);
    } catch (e) {
      console.error(e);
      showToast("Model interaction failed.");
    } finally {
      setLoading(false);
      setIsThinking(false);
    }
  };

  const handleAudioBriefing = async () => {
    if (!notebookSummary) return;
    try {
      showToast("Synthesizing mechanistic briefing...");
      const bytes = await speakText(notebookSummary);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      const buffer = await decodeAudioData(bytes, ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch (e) { showToast("Audio playback failed."); }
  };

  const handleRunSimulation = async () => {
    if (!scaffold) return;
    setLoading(true);
    setStage(AppStage.VALIDATE);
    try {
      const res = await runSynthesis(scaffold);
      setSynthesis(res);
      const rep = await generateReviewerReport(scaffold, [], res);
      setReport(rep);
    } catch (e) { showToast("Synthesis chain failed."); }
    finally { setLoading(false); }
  };

  const updateScaffoldCollaboratively = (newData: CausalGraphData) => {
    yScaffold.set('data', newData);
  };

  return (
    <div className="flex h-screen w-screen bg-[#FDFDFD] text-slate-900 overflow-hidden font-sans">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <Info size={16} className="text-indigo-400" />
          <span className="text-xs font-bold tracking-tight">{toast}</span>
        </div>
      )}

      {/* MODAL: ADD SOURCE */}
      {isAddSourceOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
             <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-black tracking-tight">Add Source</h3>
                <button onClick={() => setIsAddSourceOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
             </div>
             <div className="p-8 space-y-6">
                <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                   <button onClick={() => setNewSourceData({...newSourceData, type: 'text'})} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newSourceData.type === 'text' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Text Abstract</button>
                   <button onClick={() => setNewSourceData({...newSourceData, type: 'url'})} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${newSourceData.type === 'url' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>External URL</button>
                </div>
                <div className="space-y-4">
                   <input 
                    placeholder="Source Title (e.g., Mechanism of Action: Compound X)" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm"
                    value={newSourceData.title}
                    onChange={e => setNewSourceData({...newSourceData, title: e.target.value})}
                   />
                   <textarea 
                    placeholder={newSourceData.type === 'text' ? "Paste the research text or abstract here..." : "Enter the source URL..."}
                    className="w-full h-40 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm resize-none"
                    value={newSourceData.content}
                    onChange={e => setNewSourceData({...newSourceData, content: e.target.value})}
                   />
                </div>
             </div>
             <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={handleCreateSource}
                  disabled={!newSourceData.title || !newSourceData.content}
                  className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
                >
                  Confirm & Scaffold
                </button>
             </div>
          </div>
        </div>
      )}

      {/* LEFT DRAWER: NOTEBOOK SOURCES */}
      <aside className="w-80 border-r border-slate-200 bg-white flex flex-col shrink-0">
        <div className="p-8 border-b border-slate-100 flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-100">
            <BrainCircuit size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-slate-900">ProofSmith-R</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mechanistic Notebook</p>
          </div>
        </div>

        <div className="p-8 flex-1 overflow-y-auto space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sources</h2>
            <button 
              onClick={() => setIsAddSourceOpen(true)}
              className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="space-y-4">
            {sources.length === 0 ? (
              <div className="text-center py-16 px-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem]">
                <BookOpen size={32} className="mx-auto text-slate-300 mb-4" />
                <p className="text-xs text-slate-400 font-bold leading-relaxed">No sources yet. Add a research abstract to scaffold the mechanistic model.</p>
              </div>
            ) : (
              sources.map(s => (
                <div key={s.id} className="p-4 bg-white border border-slate-200 rounded-[1.5rem] hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-pointer group relative">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 p-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all">
                      {s.type === 'url' ? <Link size={14}/> : <FileText size={14}/>}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[11px] font-black text-slate-800 leading-tight mb-1 truncate">{s.title}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{s.type === 'url' ? 'External' : 'Abstract'}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-8 border-t border-slate-100 bg-slate-50/50">
          <button 
            onClick={handleAudioBriefing}
            disabled={!notebookSummary}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-700 disabled:opacity-30 transition-all shadow-xl shadow-slate-200"
          >
            <Volume2 size={16} /> Audio Briefing
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* TOP NAVIGATION BAR */}
        <header className="h-20 border-b border-slate-100 bg-white/80 backdrop-blur-xl flex items-center justify-between px-10 z-20 sticky top-0">
          <div className="flex items-center gap-8 h-full">
            {[
              { id: AppStage.NOTEBOOK, label: 'Notebook Guide', icon: BookOpen },
              { id: AppStage.DESIGN, label: 'Causal Scaffold', icon: BrainCircuit },
              { id: AppStage.VALIDATE, label: 'Synthesis Lab', icon: Zap }
            ].map((t) => (
              <button 
                key={t.id}
                onClick={() => setStage(t.id)}
                className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] h-full border-b-2 transition-all ${stage === t.id ? 'border-indigo-600 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <t.icon size={14}/> {t.label}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 pr-6 border-r border-slate-100">
               <div className="flex -space-x-2">
                 {activeUsers.map((u, i) => (
                   <div 
                    key={i} 
                    title={u.name}
                    className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-sm ring-1 ring-slate-100 transition-transform hover:scale-110"
                    style={{ backgroundColor: u.color }}
                   >
                     {u.name.charAt(u.name.length - 1)}
                   </div>
                 ))}
               </div>
               <div className="flex items-center gap-1.5 ml-3">
                 <Circle size={8} className="text-indigo-500 fill-indigo-500 animate-pulse" />
                 <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Live Sync</span>
               </div>
            </div>

            <button 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                showToast("Notebook link copied.");
              }} 
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-100"
            >
              <Share2 size={14}/> Share
            </button>
          </div>
        </header>

        {/* WORKSPACE VIEWPORT */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#FDFDFD]">
          {stage === AppStage.NOTEBOOK && (
            <div className="flex-1 overflow-y-auto p-12">
              <div className="max-w-4xl mx-auto space-y-16 pb-40">
                <div className="space-y-4">
                  <h2 className="text-5xl font-black tracking-tighter text-slate-900">Mechanistic Guide</h2>
                  <p className="text-slate-500 text-xl font-medium leading-relaxed max-w-2xl">
                    Interact with the causal landscape synthesized from your research sources.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all group">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <Sparkles size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight mb-2">Notebook Overview</h3>
                      <p className="text-sm text-slate-500 leading-relaxed italic line-clamp-4">
                        {notebookSummary || "Scaffold a source to generate a mechanistic summary."}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all group">
                    <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                      <Activity size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight mb-2">Model Complexity</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        {scaffold ? `Current graph contains ${scaffold.nodes.length} research variables and ${scaffold.edges.length} detected pathways.` : "Extracting causal scaffold from sources..."}
                      </p>
                      {scaffold && (
                        <button onClick={() => setStage(AppStage.DESIGN)} className="mt-4 text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2 group/btn">
                          Explore Model <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform"/>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {report && (
                  <div className="bg-slate-900 text-white rounded-[3.5rem] p-16 space-y-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:opacity-20 transition-opacity">
                       <Rocket size={120} />
                    </div>
                    <div className="relative z-10 space-y-6 max-w-2xl">
                      <h3 className="text-3xl font-black tracking-tight flex items-center gap-4">
                        <Terminal className="text-indigo-400" /> Evidence Bundle
                      </h3>
                      <p className="text-slate-400 text-lg leading-relaxed font-medium">{report.summary}</p>
                      <button onClick={() => setStage(AppStage.PROVE)} className="px-10 py-5 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-50 transition-all shadow-xl shadow-slate-950">View Protocol Report</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {stage === AppStage.DESIGN && (
            <div className="flex-1 bg-white relative">
              {scaffold ? (
                <CausalView 
                  data={scaffold} 
                  onUpdate={updateScaffoldCollaboratively} 
                  onExpandNode={async (id) => { 
                    const u = await expandCausalNode(id, scaffold); 
                    updateScaffoldCollaboratively(u); 
                  }}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-6">
                  <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center">
                    <BrainCircuit size={40} className="opacity-40" />
                  </div>
                  <p className="font-black uppercase tracking-[0.3em] text-[10px]">No mechanistic model extracted yet.</p>
                </div>
              )}
            </div>
          )}

          {stage === AppStage.VALIDATE && (
            <div className="flex-1 overflow-y-auto p-12 bg-slate-50/30">
               {synthesis ? (
                 <div className="max-w-5xl mx-auto bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl overflow-hidden mb-40">
                   <SynthesisView data={synthesis} />
                 </div>
               ) : (
                 <div className="h-full flex flex-col items-center justify-center py-32 text-center space-y-8">
                    <div className="w-24 h-24 bg-indigo-50 rounded-[3rem] flex items-center justify-center">
                      <Zap size={40} className="text-indigo-500 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-3xl font-black tracking-tight text-slate-900">Synthesizing Mechanistic Data</h3>
                      <p className="text-slate-400 max-w-md mx-auto text-lg">Stress-testing the causal pathways detected in your notebook sources...</p>
                    </div>
                 </div>
               )}
            </div>
          )}

          {stage === AppStage.PROVE && report && (
            <div className="flex-1 overflow-y-auto bg-slate-100">
              <ReportView report={report} />
            </div>
          )}
        </div>

        {/* BOTTOM CHAT: GROUNDED INTERACTION INTERFACE */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-4xl px-8 z-30">
          <div className="bg-white/95 backdrop-blur-3xl border border-slate-200 rounded-[3rem] shadow-2xl p-2 flex items-center gap-3 group focus-within:ring-8 focus-within:ring-indigo-500/5 focus-within:border-indigo-400 transition-all relative">
            
            {/* Recording Feedback Overlay */}
            {isRecording && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-[3rem] flex items-center px-10 pointer-events-none animate-in fade-in duration-300 z-10">
                <div className="flex items-center gap-4">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  </div>
                  <span className="text-sm font-black text-slate-400 uppercase tracking-widest animate-pulse">Listening... Speak now</span>
                </div>
              </div>
            )}

            <button 
              onClick={() => setIsThinking(!isThinking)}
              className={`h-14 px-6 rounded-[2.5rem] transition-all flex items-center gap-3 ${isThinking ? 'bg-slate-900 text-white shadow-xl' : 'bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-white hover:border-slate-200'}`}
              title="Deep Thinking Mode"
            >
              <Zap size={18} className={isThinking ? 'animate-pulse text-indigo-400' : ''} />
              <span className="text-[10px] font-black uppercase tracking-widest">{isThinking ? 'Thinking' : 'Reason'}</span>
            </button>
            <input 
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={sources.length === 0 ? "Add a source to start chatting..." : (isRecording ? "" : "Ask your sources about mechanisms...")}
              disabled={sources.length === 0}
              className="flex-1 bg-transparent border-none outline-none px-6 text-sm font-bold text-slate-800 placeholder:text-slate-400 disabled:cursor-not-allowed"
            />
            <div className="flex items-center gap-2 pr-2">
               <button 
                onClick={handleToggleDictation}
                className={`h-14 w-14 flex items-center justify-center transition-all rounded-full ${isRecording ? 'bg-red-50 text-red-600 shadow-inner' : 'text-slate-400 hover:text-indigo-600'}`}
                title={isRecording ? "Stop Recording" : "Start Dictation"}
               >
                 {isRecording ? <MicOff size={20} className="animate-pulse" /> : <Mic size={20}/>}
               </button>
               <button 
                onClick={handleSendMessage}
                disabled={loading || sources.length === 0 || !currentInput}
                className="h-14 px-8 bg-indigo-600 text-white rounded-[2.5rem] hover:bg-indigo-500 disabled:opacity-30 transition-all shadow-xl shadow-indigo-100 active:scale-95 flex items-center gap-2"
               >
                 {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                 <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">Send</span>
               </button>
            </div>
          </div>
        </div>

        {/* CHAT LOG OVERLAY */}
        {chatHistory.length > 0 && (
          <div className="absolute bottom-32 right-10 w-96 max-h-[600px] bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-[3rem] shadow-2xl flex flex-col overflow-hidden z-40 animate-in slide-in-from-bottom-8 duration-500">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                 <MessageSquare size={14} className="text-indigo-500"/> Investigation Log
               </span>
               <button onClick={() => setChatHistory([])} className="p-2 hover:bg-white rounded-full text-slate-400 transition-all"><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth">
              {chatHistory.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] p-6 rounded-[2rem] text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white font-bold rounded-tr-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'}`}>
                    {m.text}
                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200/20 flex flex-wrap gap-2">
                         {m.citations.map((c, ci) => (
                           <a key={ci} href={c} target="_blank" className="text-[9px] font-black uppercase tracking-widest underline opacity-60 hover:opacity-100 flex items-center gap-1">
                             <Globe size={10}/> Source {ci + 1}
                           </a>
                         ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                   <div className="bg-slate-50 p-6 rounded-[2rem] rounded-tl-none flex items-center gap-4">
                      <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Analysing context...</span>
                   </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* FLOATING ACTION: TRIGGER SYNTHESIS */}
      {scaffold && stage === AppStage.NOTEBOOK && (
        <button 
          onClick={handleRunSimulation}
          className="fixed bottom-36 right-10 w-24 h-24 bg-slate-900 text-white rounded-[3rem] shadow-2xl hover:bg-indigo-600 transition-all group flex flex-col items-center justify-center gap-2 z-20 active:scale-95"
        >
          <Rocket size={24} className="group-hover:-translate-y-1 transition-transform" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-center px-2">Run Synthesis</span>
        </button>
      )}
    </div>
  );
}
