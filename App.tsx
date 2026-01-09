
import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { AppStage, CausalGraphData, RAGSource, SimulationResult, StructuredReport, VerificationCheck } from './types';
import { extractCausalScaffold, performCalibratedRAG, runSynthesis, generateReviewerReport, expandCausalNode, mergeGraphs, runVerificationGates, parameterizeScaffold } from './services/gemini';
import CausalView from './components/CausalView';
import SynthesisView from './components/SynthesisView';
import ReportView from './components/ReportView';
import { 
  Sparkles, ShieldCheck, AlertTriangle, Info, UploadCloud, FileText, 
  X, Link, Type, CheckCircle2, Lock, XCircle, ArrowLeft, RefreshCw, 
  AlertCircle, Calculator, Plus, Search, Trash2, Rocket, 
  Mic, MicOff, BrainCircuit, Activity, Zap, Beaker, ChevronRight, Users, Wifi, ArrowRight, Loader2
} from 'lucide-react';

const steps = [
  { id: AppStage.DESIGN, label: 'Design Workspace', icon: Beaker, sub: 'Ingest & Scaffold' },
  { id: AppStage.VALIDATE, label: 'Validation Lab', icon: Zap, sub: 'Calibration & Synthesis' },
  { id: AppStage.PROVE, label: 'Evidence Bundle', icon: FileText, sub: 'Final Proof' },
];

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

export default function App() {
  const [stage, setStage] = useState<AppStage>(AppStage.DESIGN);
  const [inputText, setInputText] = useState('');
  const [ingestMode, setIngestMode] = useState<'text' | 'url' | 'file'>('text');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  const [scaffold, setScaffold] = useState<CausalGraphData | null>(null);
  const [ragSources, setRagSources] = useState<RAGSource[]>([]);
  const [synthesisData, setSynthesisData] = useState<SimulationResult | null>(null);
  const [report, setReport] = useState<StructuredReport | null>(null);
  const [verificationChecks, setVerificationChecks] = useState<VerificationCheck[]>([]);

  // Collaboration State
  const [peers, setPeers] = useState<{ name: string, color: string }[]>([]);
  const ydoc = useMemo(() => new Y.Doc(), []);
  const yScaffold = ydoc.getMap('scaffold');
  const yInput = ydoc.getText('input');
  
  // Setup Real-time Sync
  useEffect(() => {
    const roomName = 'proofsmith-scientific-collaboration';
    const provider = new WebrtcProvider(roomName, ydoc);
    
    // Presence awareness
    const name = `Scientist ${Math.floor(Math.random() * 1000)}`;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    provider.awareness.setLocalStateField('user', { name, color });

    provider.awareness.on('change', () => {
      const states = Array.from(provider.awareness.getStates().values());
      const activePeers = states
        .map((s: any) => s.user)
        .filter((u): u is { name: string, color: string } => !!u);
      setPeers(activePeers);
    });

    // Observe changes from others
    yScaffold.observe(() => {
      const remoteScaffold = yScaffold.get('data') as CausalGraphData | null;
      setScaffold(remoteScaffold || null);
    });

    yInput.observe(() => {
      setInputText(yInput.toString());
    });

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [ydoc]);

  const handleInputChange = (val: string) => {
    setInputText(val);
    if (yInput.toString() !== val) {
      ydoc.transact(() => {
        yInput.delete(0, yInput.length);
        yInput.insert(0, val);
      });
    }
  };

  const updateScaffold = (data: CausalGraphData | null) => {
    setScaffold(data);
    yScaffold.set('data', data);
  };

  // Automatic triggers for RAG and Synthesis
  useEffect(() => {
    if (stage === AppStage.VALIDATE && scaffold && !loading && ragSources.length === 0) {
      runCalibrate();
    }
  }, [stage, scaffold]);

  useEffect(() => {
    if (stage === AppStage.VALIDATE && scaffold && ragSources.length > 0 && !synthesisData && !loading) {
      runSynthesisLab();
    }
  }, [stage, ragSources, synthesisData]);

  const initSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
      }
      if (finalTranscript) handleInputChange(inputText + (inputText.length > 0 ? ' ' : '') + finalTranscript);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    return recognition;
  };

  useEffect(() => {
    recognitionRef.current = initSpeechRecognition();
    return () => { if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {} };
  }, []);

  const toggleDictation = () => {
    if (!recognitionRef.current) return showToast("Speech recognition not supported.");
    if (isRecording) {
      try { recognitionRef.current.stop(); } catch (e) {}
      setIsRecording(false);
    } else {
      try { recognitionRef.current.start(); setIsRecording(true); } catch (e) {
        recognitionRef.current = initSpeechRecognition();
      }
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleIngestAnalyze = async () => {
    if (!inputText) return;
    setLoading(true);
    try {
      const data = await extractCausalScaffold(inputText);
      updateScaffold(data);
      showToast("Mechanistic scaffold extracted.");
    } catch (e) {
      showToast("Extraction failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoRun = async () => {
    if (!scaffold || !(scaffold.nodes)) return;
    setIsAutoRunning(true);
    setLoading(true);
    try {
      showToast("Auto-Pilot: Starting mechanistic chain...");
      const terms = scaffold.nodes.map(n => n.label).join(', ');
      const ragResults = await performCalibratedRAG(`Mechanisms linking ${terms}`);
      setRagSources(ragResults);
      setStage(AppStage.VALIDATE);
      await new Promise(r => setTimeout(r, 1000));
      const simResult = await runSynthesis(scaffold);
      setSynthesisData(simResult);
      await new Promise(r => setTimeout(r, 1000));
      setStage(AppStage.VERIFYING);
      const checks = await runVerificationGates(scaffold);
      setVerificationChecks(checks);
      await new Promise(r => setTimeout(r, 1500));
      const reportResult = await generateReviewerReport(scaffold, ragResults, simResult);
      setReport(reportResult);
      setStage(AppStage.PROVE);
    } finally {
      setLoading(false);
      setIsAutoRunning(false);
    }
  };

  const handleFinalProof = async () => {
    if (!scaffold || !synthesisData || !ragSources.length) return;
    setStage(AppStage.VERIFYING);
    setLoading(true);
    try {
      const c = await runVerificationGates(scaffold); 
      setVerificationChecks(c);
      await new Promise(r => setTimeout(r, 1500));
      const r = await generateReviewerReport(scaffold, ragSources, synthesisData); 
      setReport(r);
      setStage(AppStage.PROVE);
    } finally {
      setLoading(false);
    }
  };

  const runCalibrate = async () => {
    if (!scaffold || !scaffold.nodes) return;
    setLoading(true);
    try {
      const results = await performCalibratedRAG(scaffold.nodes.map(n => n.label).join(', '));
      setRagSources(results);
    } finally { setLoading(false); }
  };

  const runSynthesisLab = async () => {
    if (!scaffold) return;
    setLoading(true);
    try {
      const result = await runSynthesis(scaffold);
      setSynthesisData(result);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 font-sans overflow-hidden relative">
      {toastMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <Info size={20} className="text-indigo-400" />
          <span className="text-sm font-bold tracking-tight">{toastMessage}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-72 bg-slate-900 text-white flex flex-col z-20 shadow-2xl shrink-0">
        <div className="p-8 border-b border-slate-800/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
              <BrainCircuit size={22} className="text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">ProofSmith-R</h1>
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] ml-1">Automated Mechanistic Reasoning</p>
        </div>

        <nav className="flex-1 p-6 space-y-3">
          {steps.map((s) => {
            const isActive = stage === s.id || (stage === AppStage.VERIFYING && s.id === AppStage.PROVE);
            const isAccessible = s.id === AppStage.DESIGN || !!scaffold;
            const Icon = s.icon;
            return (
              <button 
                key={s.id}
                onClick={() => !isAutoRunning && isAccessible && setStage(s.id)}
                disabled={!isAccessible || isAutoRunning}
                className={`w-full group flex flex-col gap-1 p-5 rounded-3xl transition-all duration-300 text-left relative ${
                  isActive ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 
                  isAccessible ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-700 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`${isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`}>
                    <Icon size={20} />
                  </div>
                  <span className="font-bold text-sm tracking-tight">{s.label}</span>
                  {isActive && <ChevronRight size={14} className="ml-auto opacity-50" />}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ml-8 ${isActive ? 'text-indigo-200' : 'text-slate-600'}`}>{s.sub}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-8 border-t border-slate-800/50 space-y-4">
          <div className="px-2 py-3 bg-slate-800/50 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Users size={12}/> Presence
              </span>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div className="flex -space-x-2 px-2 overflow-hidden">
              {peers.map((p, i) => (
                <div key={i} title={p.name} className="w-8 h-8 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white shadow-lg" style={{ backgroundColor: p.color }}>
                  {p.name.split(' ')[1]?.charAt(0) || 'S'}
                </div>
              ))}
              {peers.length === 0 && <span className="text-[10px] text-slate-600 italic">Standalone Mode</span>}
            </div>
          </div>
          <button 
            onClick={handleAutoRun}
            disabled={loading || !scaffold}
            className="w-full bg-slate-800 hover:bg-indigo-700 disabled:opacity-30 text-white p-4 rounded-2xl flex items-center justify-center gap-3 transition-all font-black text-xs uppercase tracking-widest"
          >
            <Rocket size={16} className="text-indigo-400" />
            {isAutoRunning ? 'Working...' : 'Auto-Pilot'}
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 relative flex flex-col overflow-hidden bg-white">
        
        {/* Workspace Areas */}
        <div className="flex-1 flex overflow-hidden">
          {stage === AppStage.DESIGN && (
            <div className="flex-1 flex h-full">
              <div className="w-1/2 h-full flex flex-col border-r border-slate-100 p-10 overflow-y-auto pb-40">
                <header className="mb-10 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Causal Ingest</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Contextual Input Lab</p>
                  </div>
                  <div className="flex gap-2 p-1 bg-slate-50 rounded-xl border border-slate-200">
                    {['text', 'url', 'file'].map(m => (
                      <button key={m} onClick={() => setIngestMode(m as any)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${ingestMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{m}</button>
                    ))}
                  </div>
                </header>
                <div className="relative mb-8">
                  <textarea value={inputText} onChange={(e) => handleInputChange(e.target.value)} placeholder="Enter scientific abstract or study parameters..." className="w-full h-80 p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none resize-none text-slate-700 font-mono text-sm leading-relaxed transition-all" />
                  <button onClick={toggleDictation} className={`absolute bottom-6 right-6 w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50'}`}>
                    {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
                  </button>
                </div>
                <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Live Analysis Engine</h3>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">Structure and verify causal claims in real-time. Input scientific text to generate the mechanistic scaffold on the right.</p>
                </div>
              </div>
              <div className="w-1/2 h-full flex flex-col bg-slate-50 relative overflow-hidden">
                <header className="absolute top-10 left-10 z-10">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Mechanistic Scaffold</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Interactive Logic Model</p>
                </header>
                <div className="flex-1">
                  {scaffold ? (
                    <CausalView data={scaffold} onUpdate={updateScaffold} onExpandNode={async (id) => { setIsExpanding(true); try { const u = await expandCausalNode(id, scaffold); updateScaffold(u); } finally { setIsExpanding(false); } }} isExpanding={isExpanding} />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-20 text-center">
                      <Activity size={80} className="mb-8 text-slate-200" />
                      <p className="font-black text-xl text-slate-300">Awaiting Analysis</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {stage === AppStage.VALIDATE && (
            <div className="flex-1 flex h-full">
              <div className="w-1/2 h-full flex flex-col border-r border-slate-100 p-10 overflow-y-auto pb-40">
                <header className="mb-10 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Evidence Lab</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Literature Grounding</p>
                  </div>
                  <button onClick={runCalibrate} className="p-3 bg-sky-50 text-sky-600 rounded-2xl hover:bg-sky-100 transition-all border border-sky-100 shadow-sm"><Search size={22} /></button>
                </header>
                <div className="space-y-6">
                  {loading && ragSources.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-4 text-slate-300">
                      <Loader2 size={40} className="animate-spin" />
                      <p className="font-bold uppercase tracking-widest text-xs">Calibrating RAG...</p>
                    </div>
                  ) : ragSources.length === 0 ? (
                    <div className="h-64 border-4 border-dashed border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center text-center p-10">
                      <Search size={40} className="text-slate-200 mb-4" />
                      <p className="text-slate-400 font-bold">Scanning scientific databases...</p>
                    </div>
                  ) : (
                    ragSources.map((s, i) => (
                      <div key={i} className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200 hover:border-indigo-100 transition-all group">
                        <div className="flex items-center gap-2 mb-4">
                          <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${s.methodQuality === 'High' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{s.methodQuality} Reliability</span>
                          <span className="ml-auto text-lg font-black text-slate-800">{s.confidenceScore}%</span>
                        </div>
                        <h4 className="font-bold text-slate-900 leading-tight mb-3 group-hover:text-indigo-600 transition-colors">{s.title}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed mb-6">{s.snippet}</p>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 text-[10px] text-slate-500 italic flex gap-3">
                          <Sparkles size={16} className="text-indigo-400 shrink-0" /> {s.confidenceReason}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="w-1/2 h-full flex flex-col bg-slate-50 p-10 overflow-y-auto pb-40 relative">
                <header className="mb-10 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Simulation Lab</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">In-Silico Verification</p>
                  </div>
                  <button onClick={runSynthesisLab} className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-all border border-emerald-100 shadow-sm"><Activity size={22} /></button>
                </header>
                <div className="flex-1 min-h-[600px]">
                  {loading && !synthesisData && ragSources.length > 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-300">
                      <Loader2 size={40} className="animate-spin text-indigo-500" />
                      <p className="font-bold uppercase tracking-widest text-xs">Synthesizing Counterfactuals...</p>
                    </div>
                  ) : synthesisData ? (
                    <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden h-full">
                      <SynthesisView data={synthesisData} />
                    </div>
                  ) : (
                    <div className="h-full border-4 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-center p-20 text-slate-300">
                      <Zap size={60} className="mb-6" />
                      <p className="font-bold text-lg">Stress-Test Pending</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {stage === AppStage.PROVE && report && (
            <div className="flex-1 overflow-hidden h-full">
              <ReportView report={report} />
            </div>
          )}

          {stage === AppStage.VERIFYING && (
            <div className="flex-1 flex flex-col items-center justify-center p-20 bg-slate-900 text-white">
              <div className="max-w-md w-full text-center">
                <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-500/50 mx-auto mb-12 animate-pulse">
                  <ShieldCheck size={48} />
                </div>
                <h2 className="text-3xl font-black tracking-tight mb-8">Formal Verification</h2>
                <div className="space-y-4">
                  {(verificationChecks || []).length > 0 ? verificationChecks.map((v, i) => (
                    <div key={i} className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/10 animate-in slide-in-from-bottom-2" style={{animationDelay: `${i*100}ms`}}>
                      <div className="text-left">
                        <p className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-1">{v.name}</p>
                        <p className="text-[11px] text-slate-500">{v.message}</p>
                      </div>
                      {v.status === 'Pass' ? <CheckCircle2 className="text-emerald-500" size={24} /> : <AlertTriangle className="text-amber-500" size={24} />}
                    </div>
                  )) : (
                    <div className="flex flex-col items-center gap-4 py-20 opacity-40">
                      <Loader2 size={32} className="animate-spin" />
                      <span className="text-[10px] font-black tracking-[0.3em] uppercase">Auditing Causal Graph...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* --- FLOATING NAVIGATION DOCK --- */}
        <div className="fixed bottom-10 right-10 left-[calc(18rem+2.5rem)] z-[60] flex items-center justify-end pointer-events-none">
          {stage !== AppStage.VERIFYING && (
            <div className="flex items-center gap-4 pointer-events-auto animate-in slide-in-from-bottom-6 duration-500">
              {/* Contextual Status / Back button */}
              {(stage === AppStage.VALIDATE || stage === AppStage.PROVE) && !isAutoRunning && (
                <button 
                  onClick={() => setStage(AppStage.DESIGN)} 
                  className="h-16 px-8 bg-white/90 backdrop-blur-xl border border-slate-200 text-slate-500 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-white hover:text-indigo-600 transition-all shadow-2xl flex items-center gap-3 active:scale-95"
                >
                  <ArrowLeft size={18} /> Modify Design
                </button>
              )}

              {/* Main Action Pill */}
              <div className="bg-slate-900 text-white h-20 rounded-[2.5rem] flex items-center px-3 gap-3 shadow-2xl border border-white/10 ring-8 ring-slate-900/5 min-w-[320px]">
                {stage === AppStage.DESIGN && (
                  <>
                    <button 
                      onClick={handleIngestAnalyze} 
                      disabled={loading || !inputText} 
                      className="flex-1 h-14 px-8 rounded-3xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-sm tracking-tight transition-all flex items-center justify-center gap-3"
                    >
                      {loading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                      {scaffold ? 'Re-Analyze Context' : 'Extract Mechanistic Model'}
                    </button>
                    {scaffold && !loading && (
                      <button 
                        onClick={() => setStage(AppStage.VALIDATE)}
                        className="h-14 w-14 rounded-full bg-white text-slate-900 flex items-center justify-center hover:bg-indigo-50 transition-all active:scale-90 group"
                        title="Proceed to Lab"
                      >
                        <ArrowRight size={24} className="group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    )}
                  </>
                )}

                {stage === AppStage.VALIDATE && (
                  <>
                    <button 
                      onClick={handleFinalProof} 
                      disabled={loading || !synthesisData} 
                      className="flex-1 h-14 px-8 rounded-3xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-sm tracking-tight transition-all flex items-center justify-center gap-3"
                    >
                      {loading ? <Loader2 size={20} className="animate-spin" /> : <Rocket size={20} />}
                      Compile Evidence Proof
                    </button>
                  </>
                )}

                {stage === AppStage.PROVE && (
                  <button 
                    onClick={() => window.location.reload()} 
                    className="flex-1 h-14 px-8 rounded-3xl bg-slate-800 hover:bg-indigo-700 text-white font-black text-sm tracking-tight transition-all flex items-center justify-center gap-3"
                  >
                    <RefreshCw size={20} /> New Investigation
                  </button>
                )}

                {isAutoRunning && (
                  <div className="flex-1 h-14 flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest text-indigo-300">
                    <Loader2 size={18} className="animate-spin" /> Auto-Pilot Mode Active
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
