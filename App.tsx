
import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { GoogleGenAI, Modality, LiveServerMessage, Blob } from '@google/genai';
import { AppStage, CausalGraphData, RAGSource, SimulationResult, StructuredReport, VerificationCheck } from './types';
import { extractCausalScaffold, performCalibratedRAG, runSynthesis, generateReviewerReport, expandCausalNode, runVerificationGates, deepReasonMechanism, speakText, editScientificImage } from './services/gemini';
import CausalView from './components/CausalView';
import SynthesisView from './components/SynthesisView';
import ReportView from './components/ReportView';
import { 
  Sparkles, ShieldCheck, AlertTriangle, Info, FileText, 
  ArrowLeft, RefreshCw, Search, Rocket, 
  Mic, MicOff, BrainCircuit, Activity, Zap, Beaker, ChevronRight, Users, Wifi, ArrowRight, Loader2, Share2, Check, X, ShieldAlert,
  CheckCircle2, Volume2, Image as ImageIcon, Wand2, MessageSquareText
} from 'lucide-react';

const steps = [
  { id: AppStage.DESIGN, label: 'Design Workspace', icon: Beaker, sub: 'Ingest & Scaffold' },
  { id: AppStage.VALIDATE, label: 'Validation Lab', icon: Zap, sub: 'Calibration & Synthesis' },
  { id: AppStage.PROVE, label: 'Evidence Bundle', icon: FileText, sub: 'Final Proof' },
];

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export default function App() {
  const [stage, setStage] = useState<AppStage>(AppStage.DESIGN);
  const [inputText, setInputText] = useState('');
  const [ingestMode, setIngestMode] = useState<'text' | 'url' | 'file'>('text');
  const [loading, setLoading] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [deepReasoningText, setDeepReasoningText] = useState<string | null>(null);
  
  // Image Laboratory state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [isEditingImage, setIsEditingImage] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [scaffold, setScaffold] = useState<CausalGraphData | null>(null);
  const [ragSources, setRagSources] = useState<RAGSource[]>([]);
  const [synthesisData, setSynthesisData] = useState<SimulationResult | null>(null);
  const [report, setReport] = useState<StructuredReport | null>(null);
  const [verificationChecks, setVerificationChecks] = useState<VerificationCheck[]>([]);

  // Collaboration state
  const [roomID, setRoomID] = useState<string>('');
  const [peers, setPeers] = useState<{ id: string, name: string, color: string, status: string }[]>([]);
  const [pendingRequests, setPendingRequests] = useState<{ id: string, name: string }[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const ydoc = useMemo(() => new Y.Doc(), []);
  const yScaffold = ydoc.getMap('scaffold');
  const yInput = ydoc.getText('input');
  const yAccess = ydoc.getMap('accessControl');

  const myID = useMemo(() => `scientist_${Math.floor(Math.random() * 10000)}`, []);

  useEffect(() => {
    let currentHash = window.location.hash.substring(1);
    const hostStatus = !currentHash;
    if (hostStatus) {
      currentHash = Math.random().toString(36).substring(2, 12);
      window.location.hash = currentHash;
      yAccess.set(myID, 'allowed');
    }
    setRoomID(currentHash);
    const provider = new WebrtcProvider(`proofsmith-${currentHash}`, ydoc);
    provider.awareness.setLocalStateField('user', { id: myID, name: `Researcher ${myID.split('_')[1]}`, color: COLORS[Math.floor(Math.random() * COLORS.length)] });
    provider.awareness.on('change', () => {
      const states = Array.from(provider.awareness.getStates().entries());
      setPeers(states.map(([clientId, state]: [number, any]) => ({
        id: state.user?.id || `client_${clientId}`,
        name: state.user?.name || 'Unknown',
        color: state.user?.color || '#94a3b8',
        status: yAccess.get(state.user?.id) === 'allowed' ? 'allowed' : 'pending'
      })).filter(p => p.id !== myID));
      if (yAccess.get(myID) === 'allowed') {
        setPendingRequests(states.filter(([_, state]) => state.user && yAccess.get(state.user.id) !== 'allowed').map(([_, state]) => ({ id: state.user.id, name: state.user.name })));
      }
    });
    const checkAdmission = () => yAccess.get(myID) === 'allowed' ? setStage(p => p === AppStage.JOINING ? AppStage.DESIGN : p) : setStage(AppStage.JOINING);
    yAccess.observe(checkAdmission);
    checkAdmission();
    yScaffold.observe(() => setScaffold(yScaffold.get('data') as CausalGraphData | null));
    yInput.observe(() => { if (yInput.toString() !== inputText) setInputText(yInput.toString()); });
    return () => { provider.destroy(); ydoc.destroy(); };
  }, [ydoc, myID]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopySuccess(true);
    showToast("Session link copied.");
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleInputChange = (val: string) => {
    setInputText(val);
    if (yInput.toString() !== val) {
      ydoc.transact(() => { yInput.delete(0, yInput.length); yInput.insert(0, val); });
    }
  };

  const handleDeepThinking = async () => {
    if (!scaffold || scaffold.nodes.length === 0) return;
    setLoading(true);
    try {
      const targetNode = scaffold.nodes[0];
      const result = await deepReasonMechanism(targetNode.label, scaffold);
      setDeepReasoningText(result);
    } finally {
      setLoading(false);
    }
  };

  const handleTTS = async () => {
    if (!report) return;
    try {
      showToast("Generating audio summary...");
      const audioBytes = await speakText(report.summary);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffer = await ctx.decodeAudioData(audioBytes.buffer);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch (e) {
      showToast("Audio synthesis failed.");
    }
  };

  const handleImageEdit = async () => {
    if (!uploadedImage || !imagePrompt) return;
    setIsEditingImage(true);
    try {
      const base64 = uploadedImage.split(',')[1];
      const result = await editScientificImage(base64, imagePrompt);
      setUploadedImage(result);
      showToast("Image processed by Nano Banana.");
    } catch (e) {
      showToast("Image editing failed.");
    } finally {
      setIsEditingImage(false);
    }
  };

  const toggleDictation = async () => {
    if (isRecording) { stopDictation(); return; }
    try {
      setLoading(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025', // Optimized for live transcription
        callbacks: {
          onopen: () => { setIsRecording(true); setLoading(false); showToast("Listening for research context..."); },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              if (text) handleInputChange(inputText + (inputText.length > 0 ? ' ' : '') + text);
            }
          },
          onerror: () => stopDictation(),
          onclose: () => setIsRecording(false)
        },
        config: { responseModalities: [Modality.AUDIO], inputAudioTranscription: {}, systemInstruction: 'Transcribe scientific dictation precisely for a causal research workspace.' }
      });
      liveSessionRef.current = await sessionPromise;
      
      const source = audioContext.createMediaStreamSource(stream);
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
        const pcmBlob = createBlob(inputData);
        sessionPromise.then((session) => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      };
      source.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);
      (window as any)._proofSmithProcessor = scriptProcessor;

    } catch (e) { showToast("Mic access failed."); setLoading(false); }
  };

  const stopDictation = () => {
    if (liveSessionRef.current) liveSessionRef.current.close();
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    if ((window as any)._proofSmithProcessor) {
      (window as any)._proofSmithProcessor.disconnect();
      delete (window as any)._proofSmithProcessor;
    }
    setIsRecording(false);
  };

  const handleIngestAnalyze = async () => {
    if (!inputText) return;
    setLoading(true);
    try {
      const data = await extractCausalScaffold(inputText);
      setScaffold(data);
      yScaffold.set('data', data);
      showToast("Scaffold built.");
    } finally { setLoading(false); }
  };

  const handleAutoRun = async () => {
    if (!scaffold) return;
    setIsAutoRunning(true);
    setLoading(true);
    try {
      const rag = await performCalibratedRAG(scaffold.nodes.map(n => n.label).join(', '));
      setRagSources(rag);
      setStage(AppStage.VALIDATE);
      const sim = await runSynthesis(scaffold);
      setSynthesisData(sim);
      setStage(AppStage.VERIFYING);
      const checks = await runVerificationGates(scaffold);
      setVerificationChecks(checks);
      const rep = await generateReviewerReport(scaffold, rag, sim);
      setReport(rep);
      setStage(AppStage.PROVE);
    } finally { setLoading(false); setIsAutoRunning(false); }
  };

  const showToast = (msg: string) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 4000); };

  return (
    <div className="flex h-screen w-screen bg-slate-50 font-sans overflow-hidden relative">
      {toastMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <Info size={20} className="text-indigo-400" />
          <span className="text-sm font-bold tracking-tight">{toastMessage}</span>
        </div>
      )}

      <aside className="w-72 bg-slate-900 text-white flex flex-col z-20 shadow-2xl shrink-0">
        <div className="p-8 border-b border-slate-800/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20"><BrainCircuit size={22} className="text-white" /></div>
            <h1 className="text-2xl font-black tracking-tighter text-white">ProofSmith-R</h1>
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Causal Auto-Scientist</p>
        </div>

        <nav className="flex-1 p-6 space-y-3">
          {steps.map((s) => (
            <button key={s.id} onClick={() => setStage(s.id)} disabled={stage === AppStage.JOINING} className={`w-full p-5 rounded-3xl text-left transition-all ${stage === s.id ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-800'}`}>
              <div className="flex items-center gap-3"><s.icon size={20} /><span className="font-bold text-sm">{s.label}</span></div>
              <span className="text-[10px] font-bold uppercase tracking-wider ml-8 opacity-60">{s.sub}</span>
            </button>
          ))}
        </nav>

        <div className="p-8 border-t border-slate-800/50 space-y-4">
          <div className="px-4 py-4 bg-slate-800/50 rounded-[2rem] flex flex-col gap-4">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Users size={12}/> Presence
              <button onClick={handleShare} className="p-1 hover:text-white transition-all"><Share2 size={14}/></button>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold">ME</div>
              {peers.map((p, i) => <div key={i} title={p.name} className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: p.color }}>{p.name.charAt(0)}</div>)}
            </div>
          </div>
          <button onClick={handleAutoRun} disabled={loading || !scaffold} className="w-full bg-slate-800 hover:bg-indigo-700 text-white p-4 rounded-2xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest"><Rocket size={16} /> Auto-Pilot</button>
        </div>
      </aside>

      <main className="flex-1 relative flex flex-col overflow-hidden bg-white">
        {stage === AppStage.JOINING && (
          <div className="absolute inset-0 z-[100] bg-white/90 backdrop-blur-3xl flex flex-col items-center justify-center p-20 text-center animate-in fade-in duration-700">
             <Loader2 size={40} className="animate-spin text-indigo-600 mb-6" />
             <h2 className="text-3xl font-black mb-2">Requesting Entry</h2>
             <p className="text-slate-500">Waiting for a researcher to admit you to #{roomID}</p>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {stage === AppStage.DESIGN && (
            <div className="flex-1 flex">
              <div className="w-1/2 h-full flex flex-col border-r p-10 overflow-y-auto pb-40">
                <header className="mb-10 flex justify-between items-end">
                   <div>
                     <h2 className="text-2xl font-black text-slate-900 tracking-tight">Intelligence Lab</h2>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nano Banana & Gemini 3</p>
                   </div>
                </header>
                
                <div className="space-y-10">
                  <div className="relative">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Hypothesis Input</label>
                    <textarea value={inputText} onChange={(e) => handleInputChange(e.target.value)} placeholder="Type or use mic to dictate..." className="w-full h-40 p-6 bg-slate-50 border rounded-[2rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none resize-none text-sm leading-relaxed" />
                    <button onClick={toggleDictation} disabled={loading} className={`absolute bottom-4 right-4 w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50'}`}>
                      {loading ? <Loader2 size={20} className="animate-spin" /> : isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                  </div>

                  <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white">
                    <div className="flex items-center gap-3 mb-6">
                       <ShieldCheck size={18} className="text-indigo-400" />
                       <h3 className="text-xs font-black uppercase tracking-widest">Deep Thinking Mode</h3>
                    </div>
                    <p className="text-xs text-slate-400 mb-6 leading-relaxed">Engage Gemini 3 Pro with maximum thinking budget to analyze complex causal pathways and discover hidden confounders.</p>
                    <button onClick={handleDeepThinking} disabled={loading || !scaffold} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                       <Zap size={14} /> Reason mechanisms
                    </button>
                    {deepReasoningText && (
                      <div className="mt-6 p-6 bg-white/5 rounded-2xl text-[11px] leading-relaxed text-slate-200 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                        <MessageSquareText size={14} className="mb-2 text-indigo-400" />
                        {deepReasoningText}
                      </div>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-[2.5rem] p-8">
                     <div className="flex items-center gap-3 mb-6">
                        <ImageIcon size={18} className="text-indigo-600" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Image Laboratory</h3>
                     </div>
                     {!uploadedImage ? (
                        <div className="h-40 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-slate-400">
                           <input type="file" accept="image/*" onChange={(e) => {
                             const f = e.target.files?.[0];
                             if (f) {
                               const reader = new FileReader();
                               reader.onload = (re) => setUploadedImage(re.target?.result as string);
                               reader.readAsDataURL(f);
                             }
                           }} className="hidden" id="img-up" />
                           <label htmlFor="img-up" className="cursor-pointer flex flex-col items-center">
                              <Wand2 size={24} className="mb-2"/>
                              <span className="text-[10px] font-bold uppercase tracking-widest">Upload Scientific Diagram</span>
                           </label>
                        </div>
                     ) : (
                       <div className="space-y-4">
                          <div className="relative rounded-2xl overflow-hidden aspect-video border border-slate-200">
                             <img src={uploadedImage} className="w-full h-full object-cover" />
                             <button onClick={() => setUploadedImage(null)} className="absolute top-2 right-2 p-1 bg-white/80 rounded-full"><X size={14}/></button>
                          </div>
                          <div className="flex gap-2">
                             <input value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder="Nano Banana prompt: e.g. 'Add metabolic flow'..." className="flex-1 px-4 py-3 bg-slate-50 border rounded-xl text-xs outline-none" />
                             <button onClick={handleImageEdit} disabled={isEditingImage} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-indigo-600 disabled:opacity-50">
                                {isEditingImage ? <Loader2 size={14} className="animate-spin" /> : 'Edit'}
                             </button>
                          </div>
                       </div>
                     )}
                  </div>
                </div>
              </div>
              
              <div className="w-1/2 h-full bg-slate-50 relative overflow-hidden">
                <header className="absolute top-10 left-10 z-10 pointer-events-none">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Scaffold Workspace</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity size={12}/> Live Mechanistic Model
                  </p>
                </header>
                {scaffold ? (
                  <CausalView data={scaffold} onUpdate={(d) => { setScaffold(d); yScaffold.set('data', d); }} onExpandNode={async (id) => { setIsExpanding(true); try { const u = await expandCausalNode(id, scaffold); setScaffold(u); yScaffold.set('data', u); } finally { setIsExpanding(false); } }} isExpanding={isExpanding} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-20 text-center opacity-30">
                    <BrainCircuit size={80} className="mb-6" />
                    <p className="font-black text-xl uppercase tracking-widest">Awaiting Analysis</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {stage === AppStage.VALIDATE && (
            <div className="flex-1 flex h-full">
               <div className="w-1/2 h-full border-r p-10 overflow-y-auto pb-40">
                  <h2 className="text-2xl font-black text-slate-900 mb-8">Evidence Grounding</h2>
                  <div className="space-y-6">
                    {ragSources.map((s, i) => (
                      <div key={i} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200">
                        <div className="flex items-center gap-2 mb-3">
                           <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[9px] font-black uppercase">{s.methodQuality} RELIABILITY</span>
                           <span className="ml-auto text-lg font-black text-slate-800">{s.confidenceScore}%</span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm mb-2">{s.title}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed italic">"{s.snippet}"</p>
                      </div>
                    ))}
                  </div>
               </div>
               <div className="w-1/2 h-full bg-slate-50 p-10 overflow-y-auto">
                  <h2 className="text-2xl font-black text-slate-900 mb-8">Synthetic Lab</h2>
                  {synthesisData && <SynthesisView data={synthesisData} />}
               </div>
            </div>
          )}

          {stage === AppStage.PROVE && report && (
            <div className="flex-1 overflow-hidden relative">
              <ReportView report={report} />
              <button onClick={handleTTS} className="fixed bottom-12 left-[calc(18rem+4rem)] z-[70] h-16 w-16 bg-white border border-slate-200 rounded-full shadow-2xl flex items-center justify-center text-indigo-600 hover:scale-110 active:scale-95 transition-all group">
                <Volume2 size={24} className="group-hover:animate-pulse" />
                <span className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">Narration</span>
              </button>
            </div>
          )}

          {stage === AppStage.VERIFYING && (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 text-white p-20 text-center">
               <Loader2 size={48} className="animate-spin text-indigo-500 mb-10" />
               <h2 className="text-3xl font-black mb-10">Cross-Examining Evidence</h2>
               <div className="max-w-md w-full space-y-4">
                  {verificationChecks.map((v, i) => (
                    <div key={i} className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/10 animate-in slide-in-from-bottom-2">
                       <span className="text-xs font-black uppercase tracking-widest">{v.name}</span>
                       {v.status === 'Pass' ? <CheckCircle2 className="text-emerald-500" /> : <AlertTriangle className="text-amber-500" />}
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>

        <div className="fixed bottom-10 right-10 left-[calc(18rem+2.5rem)] z-[60] flex items-center justify-end pointer-events-none">
          {stage !== AppStage.VERIFYING && stage !== AppStage.JOINING && (
            <div className="flex items-center gap-4 pointer-events-auto animate-in slide-in-from-bottom-6 duration-500">
              {(stage === AppStage.VALIDATE || stage === AppStage.PROVE) && !isAutoRunning && (
                <button onClick={() => setStage(AppStage.DESIGN)} className="h-16 px-8 bg-white/90 backdrop-blur-xl border border-slate-200 text-slate-500 rounded-3xl font-black text-xs uppercase tracking-widest hover:text-indigo-600 transition-all shadow-2xl flex items-center gap-3">
                  <ArrowLeft size={18} /> Back to Design
                </button>
              )}
              <div className="bg-slate-900 text-white h-20 rounded-[2.5rem] flex items-center px-3 gap-3 shadow-2xl border border-white/10 min-w-[320px]">
                {stage === AppStage.DESIGN && (
                  <button onClick={handleIngestAnalyze} disabled={loading || !inputText} className="flex-1 h-14 px-8 rounded-3xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-sm transition-all flex items-center justify-center gap-3">
                    {loading && !isRecording ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                    {scaffold ? 'Refresh Model' : 'Analyze Scaffold'}
                  </button>
                )}
                {stage === AppStage.VALIDATE && (
                  <button onClick={() => setStage(AppStage.PROVE)} className="flex-1 h-14 px-8 rounded-3xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition-all flex items-center justify-center gap-3">
                    <Rocket size={20} /> Compile Evidence
                  </button>
                )}
                {stage === AppStage.PROVE && (
                  <button onClick={() => window.location.reload()} className="flex-1 h-14 px-8 rounded-3xl bg-slate-800 hover:bg-indigo-700 text-white font-black text-sm transition-all flex items-center justify-center gap-3">
                    <RefreshCw size={20} /> New Investigation
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
