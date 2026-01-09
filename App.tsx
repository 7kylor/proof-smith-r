
import React, { useState, useEffect, useRef } from 'react';
import { AppStage, CausalGraphData, RAGSource, SimulationResult, StructuredReport, VerificationCheck } from './types';
import { extractCausalScaffold, performCalibratedRAG, runSynthesis, generateReviewerReport, expandCausalNode, mergeGraphs, runVerificationGates, parameterizeScaffold } from './services/gemini';
import CausalView from './components/CausalView';
import SynthesisView from './components/SynthesisView';
import ReportView from './components/ReportView';
import { Sparkles, ShieldCheck, AlertTriangle, Info, UploadCloud, FileText, X, Link, Type, CheckCircle2, Lock, XCircle, ArrowLeft, RefreshCw, AlertCircle, PlayCircle, Calculator, Plus, Search, Trash2, Rocket, Mic, MicOff, Globe, Zap, Scale, Target, BrainCircuit, Activity } from 'lucide-react';

const steps = [
  { id: AppStage.INGEST, label: 'Ingest', icon: () => <Type size={18} /> },
  { id: AppStage.SCAFFOLD, label: 'Scaffold', icon: () => <Activity size={18} /> },
  { id: AppStage.RAG, label: 'Calibrate', icon: () => <Search size={18} /> },
  { id: AppStage.SYNTHESIS, label: 'Synthesize', icon: () => <Zap size={18} /> },
  { id: AppStage.REPORT, label: 'Proof Bundle', icon: () => <FileText size={18} /> },
];

const ImpactSection = () => (
  <div className="mt-16 space-y-12 pb-20">
    <div className="text-center max-w-3xl mx-auto">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-widest mb-4 border border-indigo-100">
        <Globe size={12} /> Addressing Global Challenges
      </div>
      <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">Solving the Reproducibility Crisis</h2>
      <p className="text-xl text-slate-500 leading-relaxed">
        Over 50% of preclinical research cannot be replicated, costing billions and stalling life-saving breakthroughs. 
        <span className="text-indigo-600 font-semibold"> ProofSmith-R</span> is the adversarial audit layer for modern science.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 px-4">
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
          <Zap size={24} />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-3">Discovery Velocity</h3>
        <p className="text-slate-600 leading-relaxed text-sm">
          Accelerating hypothesis validation from months to minutes. We eliminate "dead-end" experiments by identifying structural flaws before the lab work begins.
        </p>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
          <Scale size={24} />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-3">Mechanistic Rigor</h3>
        <p className="text-slate-600 leading-relaxed text-sm">
          Moving science beyond correlation. By enforcing Structural Causal Models (SCMs), we force models to account for confounding variables and feedback loops.
        </p>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-6 group-hover:bg-amber-600 group-hover:text-white transition-colors">
          <Target size={24} />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-3">Calibrated Proofs</h3>
        <p className="text-slate-600 leading-relaxed text-sm">
          Evidence isn't binary. Our calibrated RAG weighs every citation by methodology quality, providing a "Truth Score" for every mechanistic link.
        </p>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
        <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600 mb-6 group-hover:bg-sky-600 group-hover:text-white transition-colors">
          <BrainCircuit size={24} />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-3">AI Transparency</h3>
        <p className="text-slate-600 leading-relaxed text-sm">
          Every conclusion includes executable Python code. We don't just "predict"—we provide the mechanistic proof bundle for public verification.
        </p>
      </div>
    </div>

    <div className="bg-slate-900 rounded-[2.5rem] p-10 lg:p-16 text-white relative overflow-hidden shadow-2xl border border-white/10">
      <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12">
        <div className="flex-1">
          <div className="flex items-center gap-3 text-indigo-400 font-bold tracking-tighter mb-6">
            <Activity size={24} />
            <span className="text-lg uppercase tracking-widest">Vision 2026</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight">Toward a Autonomous Mechanistic Scientist</h2>
          <p className="text-slate-300 text-lg mb-8 leading-relaxed max-w-2xl">
            Our vision is a world where scientific claims are instantly verifiable. By coupling Large Language Models with structural causal reasoning and synthetic stress-testing, ProofSmith-R builds a foundation for high-trust discovery.
          </p>
          <div className="flex flex-wrap items-center gap-8">
            <div>
              <div className="text-4xl font-black text-indigo-400">8.2x</div>
              <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold mt-1">Research Efficiency Gain</div>
            </div>
            <div className="w-px h-12 bg-slate-700 hidden sm:block"></div>
            <div>
              <div className="text-4xl font-black text-emerald-400">92%</div>
              <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold mt-1">Verification Accuracy</div>
            </div>
          </div>
        </div>
        <div className="w-full lg:w-2/5">
          <div className="bg-white/5 p-8 rounded-3xl backdrop-blur-xl border border-white/10 shadow-inner">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300 mb-6">Target Deployment Scenarios</h4>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
                <div>
                  <span className="block text-sm font-bold text-white">Drug Repurposing</span>
                  <p className="text-xs text-slate-400 mt-1">Rapidly verifying off-target causal mechanisms for existing compounds.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
                <div>
                  <span className="block text-sm font-bold text-white">Public Policy Audit</span>
                  <p className="text-xs text-slate-400 mt-1">Stress-testing the causal assumptions behind socio-economic interventions.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                <div>
                  <span className="block text-sm font-bold text-slate-200">Adversarial Peer Review</span>
                  <p className="text-xs text-slate-500 mt-1 italic">Phase II: Automated structural auditing of new journal submissions.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 bg-indigo-600 rounded-full blur-[120px] opacity-20"></div>
      <div className="absolute bottom-0 left-0 -ml-32 -mb-32 w-80 h-80 bg-emerald-600 rounded-full blur-[120px] opacity-20"></div>
    </div>
  </div>
);

export default function App() {
  const [stage, setStage] = useState<AppStage>(AppStage.INGEST);
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
  const [ragSearchTerm, setRagSearchTerm] = useState('');
  const [synthesisData, setSynthesisData] = useState<SimulationResult | null>(null);
  const [report, setReport] = useState<StructuredReport | null>(null);
  const [verificationChecks, setVerificationChecks] = useState<VerificationCheck[]>([]);

  // Robust Speech Recognition Initialization
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
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setInputText(prev => prev + (prev.length > 0 ? ' ' : '') + finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      
      if (event.error === 'network') {
        showToast("Network Error: Speech service unreachable. Check connection or use keyboard.");
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        showToast("Permission Denied: Please enable microphone access in browser settings.");
      } else if (event.error === 'no-speech') {
        // Silently stop if no speech detected
      } else {
        showToast(`Dictation Error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    return recognition;
  };

  useEffect(() => {
    recognitionRef.current = initSpeechRecognition();
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    };
  }, []);

  const toggleDictation = () => {
    if (!recognitionRef.current) {
      showToast("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error("Failed to stop recognition", e);
      }
      setIsRecording(false);
      showToast("Dictation stopped.");
    } else {
      if (!navigator.onLine) {
        showToast("Connectivity Issue: Speech recognition requires an active internet connection.");
        return;
      }
      
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        showToast("Mechanistic listener active. Speak clearly...");
      } catch (e) {
        console.error("Failed to start recognition", e);
        // If it fails to start, try re-initializing
        recognitionRef.current = initSpeechRecognition();
        showToast("Retrying voice service...");
      }
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000); // Longer duration for critical network messages
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (file.type === "text/plain" || file.name.endsWith(".csv") || file.name.endsWith(".json") || file.name.endsWith(".md")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) setInputText(event.target.result as string);
        };
        reader.readAsText(file);
      } else {
        setInputText(`[Simulated content extraction from file: ${file.name}]\n\nAbstract: This study investigates the mechanistic link between variable X and outcome Y...`);
      }
    }
  };

  const resetDownstream = (fromStage: AppStage) => {
    if (fromStage === AppStage.INGEST) {
      setRagSources([]);
      setSynthesisData(null);
      setReport(null);
      setVerificationChecks([]);
    } else if (fromStage === AppStage.SCAFFOLD) {
      if (ragSources.length > 0) {
        setRagSources([]);
        setSynthesisData(null);
        setReport(null);
        setVerificationChecks([]);
        showToast("Downstream results cleared due to model updates.");
      }
    }
  };

  const handleIngestReplace = async () => {
    if (!inputText) return;
    setLoading(true);
    try {
      const data = await extractCausalScaffold(inputText);
      setScaffold(data);
      setRagSources([]);
      setSynthesisData(null);
      setReport(null);
      setVerificationChecks([]);
      setStage(AppStage.SCAFFOLD);
      showToast("Model initialized from new input.");
    } catch (e) {
      console.error(e);
      showToast("Failed to process input.");
    } finally {
      setLoading(false);
    }
  };

  const handleIngestMerge = async () => {
    if (!inputText || !scaffold) return;
    setLoading(true);
    try {
      const newData = await extractCausalScaffold(inputText);
      const mergedData = mergeGraphs(scaffold, newData);
      setScaffold(mergedData);
      setRagSources([]);
      setSynthesisData(null);
      setReport(null);
      setVerificationChecks([]);
      setStage(AppStage.SCAFFOLD);
      showToast("New data merged into Causal Scaffold.");
    } catch (e) {
      console.error(e);
      showToast("Merge failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleScaffoldUpdate = (newData: CausalGraphData) => {
    setScaffold(newData);
    resetDownstream(AppStage.SCAFFOLD);
  };
  
  const handleParameterize = async () => {
    if(!scaffold) return;
    setLoading(true);
    try {
        const parameterized = await parameterizeScaffold(scaffold);
        setScaffold(parameterized);
        showToast("Equation discovery complete. Simulation enabled.");
    } catch(e) {
        console.error(e);
        showToast("Parameterization failed.");
    } finally {
        setLoading(false);
    }
  };

  const handleExpandNode = async (nodeId: string) => {
    if (!scaffold) return;
    setIsExpanding(true);
    try {
      const updatedGraph = await expandCausalNode(nodeId, scaffold);
      setScaffold(updatedGraph);
      resetDownstream(AppStage.SCAFFOLD);
      showToast("Graph expanded with AI insights.");
    } catch (e) {
      console.error("Failed to expand node:", e);
      showToast("Expansion failed.");
    } finally {
      setIsExpanding(false);
    }
  };

  const handleAutoRun = async () => {
    if (!scaffold) return;
    if (isAutoRunning) return;
    setIsAutoRunning(true);
    setLoading(true);
    try {
      showToast("Auto-Pilot: Calibrating Evidence...");
      const terms = scaffold.nodes.map(n => n.label).join(', ');
      const ragResults = await performCalibratedRAG(`Mechanisms linking ${terms}`);
      setRagSources(ragResults);
      setStage(AppStage.RAG);
      await new Promise(r => setTimeout(r, 2000));
      showToast("Auto-Pilot: Running Stress Tests...");
      const simResult = await runSynthesis(scaffold);
      setSynthesisData(simResult);
      setStage(AppStage.SYNTHESIS);
      await new Promise(r => setTimeout(r, 2000));
      setStage(AppStage.VERIFICATION);
      const checks = await runVerificationGates(scaffold);
      setVerificationChecks(checks);
      await new Promise(r => setTimeout(r, 3000));
      showToast("Auto-Pilot: Generating Proof Bundle...");
      const reportResult = await generateReviewerReport(scaffold, ragResults, simResult);
      setReport(reportResult);
      setStage(AppStage.REPORT);
      showToast("Pipeline Complete.");
    } catch (e) {
      console.error("Auto-Pilot Failed", e);
      showToast("Auto-Pilot sequence interrupted.");
    } finally {
      setLoading(false);
      setIsAutoRunning(false);
    }
  };

  const handleRAG = async () => {
    if (!scaffold) return;
    setLoading(true);
    try {
      const terms = scaffold.nodes.map(n => n.label).join(', ');
      const results = await performCalibratedRAG(`Mechanisms linking ${terms}`);
      setRagSources(results);
      setStage(AppStage.RAG);
      showToast("Evidence calibration complete.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleRAGSearch = async () => {
    if (!ragSearchTerm) return;
    setLoading(true);
    try {
      const results = await performCalibratedRAG(ragSearchTerm);
      setRagSources(prev => {
         const existingUrls = new Set(prev.map(s => s.url));
         const uniqueNew = results.filter(s => !existingUrls.has(s.url));
         return [...prev, ...uniqueNew];
      });
      setRagSearchTerm('');
      showToast(`Added ${results.length} new sources.`);
    } catch (e) {
      console.error(e);
      showToast("Search failed.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleDismissSource = (index: number) => {
    setRagSources(prev => prev.filter((_, i) => i !== index));
    showToast("Source dismissed.");
  };

  const handleSynthesis = async () => {
    if (!scaffold) return;
    setLoading(true);
    try {
      const result = await runSynthesis(scaffold);
      setSynthesisData(result);
      setStage(AppStage.SYNTHESIS);
      showToast("Synthesis stress tests complete.");
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async () => {
    if (!scaffold || !synthesisData) return;
    setStage(AppStage.VERIFICATION);
    try {
      const checks = await runVerificationGates(scaffold);
      setVerificationChecks(checks);
      await new Promise(resolve => setTimeout(resolve, 2000));
      setLoading(true);
      const structReport = await generateReviewerReport(scaffold, ragSources, synthesisData);
      setReport(structReport);
      setStage(AppStage.REPORT);
    } catch (e) {
      console.error("Report gen failed", e);
      showToast("Report generation failed.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleNavClick = (targetStage: AppStage) => {
    if (isAutoRunning) return;
    if (targetStage === AppStage.INGEST) return setStage(targetStage);
    if (!scaffold) return;
    if (targetStage === AppStage.RAG && !ragSources.length && stage !== AppStage.RAG) return; 
    if (targetStage === AppStage.SYNTHESIS && !synthesisData && stage !== AppStage.SYNTHESIS) return;
    if (targetStage === AppStage.REPORT && !report) return;
    setStage(targetStage);
  };

  const loadSample = () => {
    if (ingestMode === 'text') {
      setInputText("We hypothesize that inhibiting the kinase mTORC1 with rapamycin will increase autophagy in HeLa cells, leading to decreased cell viability over 48 hours. However, the role of AMPK activation as a compensatory mechanism remains unclear.");
    } else if (ingestMode === 'url') {
      setInputText("https://www.nature.com/articles/s41586-023-00000-0\nhttps://www.science.org/doi/10.1126/science.ade0000");
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
      {toastMessage && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[60] bg-slate-900/90 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-md border border-white/10 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-2 bg-indigo-500 rounded-full shrink-0">
             <CheckCircle2 size={20} className="text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight">{toastMessage}</span>
        </div>
      )}

      <aside className="w-72 bg-slate-900 text-white flex flex-col shadow-xl z-20">
        <div className="p-8 border-b border-slate-800/50">
          <div className="flex items-center gap-2 mb-1">
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <BrainCircuit size={18} />
             </div>
             <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">ProofSmith-R</h1>
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] ml-1">Mechanistic Auto-Scientist</p>
        </div>
        
        <nav className="flex-1 p-6 space-y-3">
          {steps.map((s) => {
            const isActive = stage === s.id || (stage === AppStage.VERIFICATION && s.id === AppStage.REPORT);
            const isAccessible = s.id === AppStage.INGEST || 
              (s.id === AppStage.SCAFFOLD && !!scaffold) ||
              (s.id === AppStage.RAG && !!ragSources.length) ||
              (s.id === AppStage.SYNTHESIS && !!synthesisData) ||
              (s.id === AppStage.REPORT && !!report);

            return (
              <button 
                key={s.id}
                onClick={() => handleNavClick(s.id)}
                disabled={!isAccessible || isAutoRunning}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 text-left group ${
                  isActive ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 
                  isAccessible ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-700 cursor-not-allowed'
                }`}
              >
                <div className={`${isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'} transition-colors`}>
                  <s.icon />
                </div>
                <span className="font-bold text-sm tracking-tight">{s.label}</span>
                {isActive && <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />}
              </button>
            );
          })}
        </nav>

        <div className="p-8 border-t border-slate-800/50">
          <div className="flex items-center gap-3 mb-4">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Inference Mode</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
            Core Engine: Gemini 3.0 Pro<br/>
            Context: Mechanistic Calibration v4.2
          </p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10">
          <div className="flex items-center gap-4">
            {stage !== AppStage.INGEST && (
               <button onClick={() => setStage(steps[Math.max(0, steps.findIndex(s => s.id === stage) - 1)].id as AppStage)} disabled={isAutoRunning} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors disabled:opacity-30">
                 <ArrowLeft size={20} />
               </button>
            )}
            <div className="flex flex-col">
              <span className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.15em]">Active Protocol</span>
              <span className="text-slate-900 font-extrabold text-lg">{scaffold ? 'Active Causal Model #1A' : 'New Investigation'}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
             {loading && (
               <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 animate-in fade-in duration-300">
                 <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
                 <span className="text-xs font-bold uppercase tracking-wider">Processing</span>
               </div>
             )}
             
             {stage === AppStage.INGEST && !scaffold && (
               <button onClick={handleIngestReplace} disabled={loading || !inputText} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl text-sm font-black tracking-tight transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]">
                 {ingestMode === 'url' ? 'FETCH & ANALYZE' : 'ANALYZE CONTENT'}
               </button>
             )}
             
             {scaffold && !isAutoRunning && stage !== AppStage.REPORT && (
                <button 
                  onClick={handleAutoRun}
                  disabled={loading}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-2xl text-sm font-black tracking-tight shadow-xl transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                   <Rocket size={18} className="text-indigo-400" /> AUTO-PILOT
                </button>
             )}
             {isAutoRunning && (
                <div className="bg-indigo-900 text-white px-8 py-3 rounded-2xl text-sm font-black tracking-tight flex items-center gap-3 shadow-xl">
                   <div className="w-3 h-3 rounded-full bg-indigo-400 animate-ping"></div>
                   EXECUTING SEQUENCE...
                </div>
             )}
             
             {!isAutoRunning && (
               <>
                 {stage === AppStage.SCAFFOLD && (
                   <div className="flex gap-3">
                       <button onClick={handleParameterize} disabled={loading} className="bg-white hover:bg-slate-50 text-indigo-700 border-2 border-indigo-100 px-6 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2">
                          <Calculator size={18} /> Equations
                       </button>
                       <button onClick={handleRAG} disabled={loading} className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-sky-600/20 flex items-center gap-2">
                         <Search size={18} /> Calibrate Evidence
                       </button>
                   </div>
                 )}
                 {stage === AppStage.RAG && (
                   <button onClick={handleSynthesis} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2">
                     <Zap size={18} /> Run Stress Tests
                   </button>
                 )}
                 {stage === AppStage.SYNTHESIS && (
                   <button onClick={handleReport} disabled={loading} className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-violet-600/20 flex items-center gap-2">
                     <FileText size={18} /> Generate Proof Bundle
                   </button>
                 )}
               </>
             )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 relative bg-[#f8fafc]">
          {stage === AppStage.INGEST && (
            <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
                <div className="lg:col-span-7">
                  <div className="bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-sky-500"></div>
                    <h2 className="text-3xl font-black text-slate-900 mb-2">Ingest Scientific Context</h2>
                    <p className="text-slate-500 mb-8 font-medium">Initialize the mechanistic engine by providing source material.</p>
                    
                    <div className="flex gap-2 mb-8 p-1 bg-slate-100 rounded-2xl">
                      <button onClick={() => setIngestMode('text')} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${ingestMode === 'text' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Type size={18}/> Abstract</button>
                      <button onClick={() => setIngestMode('url')} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${ingestMode === 'url' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Link size={18}/> Links</button>
                      <button onClick={() => setIngestMode('file')} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${ingestMode === 'file' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><UploadCloud size={18}/> Files</button>
                    </div>

                    <div className="relative">
                      {ingestMode === 'file' ? (
                        <div className="border-4 border-dashed border-slate-100 rounded-[2rem] bg-slate-50/50 p-12 flex flex-col items-center justify-center transition-all hover:bg-indigo-50/30 hover:border-indigo-100 group min-h-[250px]">
                          {!selectedFile ? (
                            <>
                              <div className="bg-white p-6 rounded-3xl shadow-sm mb-6 text-indigo-500 group-hover:scale-110 transition-transform"><UploadCloud size={48} /></div>
                              <p className="text-lg font-bold text-slate-700">Click or drag to upload</p>
                              <p className="text-xs text-slate-400 mt-2">PDF, CSV, JSON, TXT, MD</p>
                              <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileUpload} accept=".pdf,.csv,.json,.txt,.md" />
                            </>
                          ) : (
                            <div className="flex items-center gap-6 bg-white p-6 rounded-3xl shadow-lg border border-slate-100 w-full max-w-sm animate-in zoom-in-95">
                              <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600"><FileText size={32} /></div>
                              <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-black text-slate-800 truncate">{selectedFile.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Ready for Analysis</p>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setInputText(''); }} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><X size={24} /></button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative group/area">
                          <textarea 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={ingestMode === 'text' ? "Paste scientific abstract or experimental methodology..." : "Paste publication URLs (one per line)..."}
                            className="w-full h-64 p-8 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none resize-none text-slate-700 font-mono text-base leading-relaxed transition-all"
                          />
                          <div className="absolute bottom-6 right-6 flex gap-3 items-center">
                            {ingestMode === 'text' && (
                              <button 
                                onClick={toggleDictation}
                                title={isRecording ? "Stop Dictation" : "Start Voice Dictation"}
                                className={`w-14 h-14 rounded-2xl shadow-xl transition-all flex items-center justify-center ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-red-200' : 'bg-white text-indigo-600 hover:bg-indigo-50 border border-indigo-100 shadow-indigo-100'}`}
                              >
                                {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
                              </button>
                            )}
                            {!inputText && <button onClick={loadSample} className="text-xs font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-4 py-2 rounded-xl transition-colors">LOAD SAMPLE</button>}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {scaffold && (
                      <div className="mt-10 pt-8 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500 bg-amber-50/30 p-8 rounded-3xl border border-amber-100">
                        <div className="flex items-center gap-3 mb-4">
                           <div className="p-2 bg-amber-500 rounded-lg"><AlertCircle size={20} className="text-white"/></div>
                           <h3 className="text-lg font-black text-slate-900">Active Session Warning</h3>
                        </div>
                        <p className="text-sm text-slate-600 mb-6 font-medium leading-relaxed">Modifying the root context will invalidate currently simulated results. Choose merge to integrate new findings into the existing graph.</p>
                        <div className="flex gap-4">
                          <button onClick={handleIngestMerge} disabled={loading || !inputText} className="flex-1 bg-white hover:bg-slate-50 text-indigo-700 border-2 border-indigo-100 px-6 py-4 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-3 shadow-sm active:scale-95">
                            <Sparkles size={20} className="text-indigo-500"/> MERGE DATA
                          </button>
                          <button onClick={handleIngestReplace} disabled={loading || !inputText} className="flex-1 bg-white hover:bg-red-50 text-slate-400 hover:text-red-700 border-2 border-slate-100 hover:border-red-100 px-6 py-4 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-3 shadow-sm active:scale-95">
                            <RefreshCw size={20} /> REPLACE ALL
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-8">
                  <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all"></div>
                    <h3 className="text-2xl font-black mb-6 flex items-center gap-3 italic">
                      <Rocket size={28} className="text-indigo-300" /> The Mission
                    </h3>
                    <p className="text-indigo-100 text-lg leading-relaxed mb-8 font-medium">
                      Transforming the scientific method into a rigorous, machine-verifiable pipeline. Stress-test hypotheses before the first pipetting step.
                    </p>
                    <div className="space-y-6">
                      <div className="flex items-start gap-4">
                        <div className="mt-1 p-2 bg-white/10 rounded-xl flex items-center justify-center">
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        </div>
                        <p className="text-sm text-indigo-50 leading-relaxed"><span className="font-bold">Automated Auditing:</span> Spot logical leaps and missing causal links instantly.</p>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="mt-1 p-2 bg-white/10 rounded-xl flex items-center justify-center">
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        </div>
                        <p className="text-sm text-indigo-50 leading-relaxed"><span className="font-bold">Calibrated RAG:</span> Scientific citations weighed by statistical power and study type.</p>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="mt-1 p-2 bg-white/10 rounded-xl flex items-center justify-center">
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        </div>
                        <p className="text-sm text-indigo-50 leading-relaxed"><span className="font-bold">Synthetic Validation:</span> Generate thousands of counterfactual data points to ensure robustness.</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Strategic Domains</h4>
                    <div className="flex flex-wrap gap-3">
                      <span className="px-5 py-2 bg-indigo-50 text-indigo-700 rounded-2xl text-xs font-black border border-indigo-100 uppercase tracking-tight">Computational Biology</span>
                      <span className="px-5 py-2 bg-emerald-50 text-emerald-700 rounded-2xl text-xs font-black border border-emerald-100 uppercase tracking-tight">Oncology Research</span>
                      <span className="px-5 py-2 bg-sky-50 text-sky-700 rounded-2xl text-xs font-black border border-sky-100 uppercase tracking-tight">Metabolic Signaling</span>
                      <span className="px-5 py-2 bg-slate-50 text-slate-600 rounded-2xl text-xs font-black border border-slate-100 uppercase tracking-tight">Drug Discovery</span>
                    </div>
                  </div>
                </div>
              </div>
              <ImpactSection />
            </div>
          )}

          {stage === AppStage.SCAFFOLD && scaffold && (
            <div className="h-full flex flex-col animate-in fade-in duration-500">
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Causal Scaffold</h2>
                  <p className="text-slate-500 font-medium">Interactive Graph Model. Parameterize relationships to enable simulation.</p>
                </div>
                <div className="flex gap-3">
                   <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-500">
                      <div className="w-2 h-2 rounded-full bg-indigo-500"></div> {scaffold.nodes.length} Variables
                   </div>
                </div>
              </div>
              <div className="flex-1 bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
                <CausalView data={scaffold} onUpdate={handleScaffoldUpdate} onExpandNode={handleExpandNode} isExpanding={isExpanding} />
              </div>
            </div>
          )}

          {stage === AppStage.RAG && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
               <div className="text-center">
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Evidence Retrieval</h2>
                  <p className="text-slate-500 font-medium text-lg">Calibrated RAG: Weighing literature by methodology and reliability.</p>
                </div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-400" size={24} />
                    <input 
                      type="text" 
                      value={ragSearchTerm}
                      onChange={(e) => setRagSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRAGSearch()}
                      placeholder="Search for specific mechanistic papers or datasets..."
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-base font-medium transition-all"
                    />
                  </div>
                  <button onClick={handleRAGSearch} disabled={loading || !ragSearchTerm} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                    {loading ? <div className="animate-spin w-5 h-5 border-2 border-white rounded-full border-t-transparent"></div> : <Plus size={20} />} ADD EVIDENCE
                  </button>
                </div>
              </div>

              {ragSources.length === 0 ? (
                 <div className="text-center py-24 bg-white rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center">
                    <div className="p-6 bg-amber-50 rounded-3xl text-amber-500 mb-6">
                       <AlertTriangle size={48} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-2">Evidence Needed</h3>
                    <p className="text-slate-500 mb-8 font-medium max-w-sm">The current causal scaffold hasn't been grounded in peer-reviewed literature yet.</p>
                    <button onClick={handleRAG} className="bg-sky-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-sky-600/20 hover:bg-sky-700 transition-all hover:scale-105 active:scale-95">
                      RUN CALIBRATION
                    </button>
                 </div>
              ) : (
                <div className="grid gap-6">
                  {ragSources.map((source, i) => (
                    <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all duration-300 flex justify-between items-start group relative">
                      <button onClick={() => handleDismissSource(i)} className="absolute top-6 right-6 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2" title="Dismiss Source">
                        <Trash2 size={20} />
                      </button>
                      <div className="flex-1 pr-12">
                        <div className="flex items-center gap-3 mb-4">
                           <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${source.methodQuality === 'High' ? 'bg-emerald-50 text-emerald-700' : source.methodQuality === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                             {source.methodQuality === 'High' && <ShieldCheck size={14} />}
                             {source.methodQuality === 'Medium' && <Info size={14} />}
                             {source.methodQuality === 'Low' && <AlertTriangle size={14} />}
                             {source.methodQuality} Quality Study
                           </div>
                        </div>
                        <h3 className="font-black text-slate-900 text-2xl leading-tight hover:text-indigo-600 cursor-pointer transition-colors pr-6">{source.title}</h3>
                        <p className="text-slate-500 mt-4 leading-relaxed font-medium">{source.snippet}</p>
                        <div className="mt-8 flex items-start gap-4 bg-indigo-50/50 rounded-3xl p-6 border border-indigo-100">
                           <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm shrink-0">
                              <Sparkles size={20} />
                           </div>
                           <div>
                             <span className="block text-xs font-black text-indigo-900 mb-1 uppercase tracking-widest">Calibration Metric</span>
                             <p className="text-sm text-indigo-900/70 font-medium leading-relaxed italic">{source.confidenceReason}</p>
                           </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-center justify-center min-w-[140px] pl-8 border-l-2 border-slate-50">
                        <div className="relative w-28 h-28">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                            <path className="transition-all duration-1000 ease-out" strokeDasharray={`${source.confidenceScore}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={source.confidenceScore > 80 ? '#10b981' : source.confidenceScore > 50 ? '#f59e0b' : '#ef4444'} strokeWidth="3" strokeLinecap="round" />
                          </svg>
                          <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
                            <span className={`text-3xl font-black ${source.confidenceScore > 80 ? 'text-emerald-600' : source.confidenceScore > 50 ? 'text-amber-600' : 'text-red-600'}`}>{source.confidenceScore}</span>
                            <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest mt-1">Score</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {stage === AppStage.SYNTHESIS && (
             <div className="h-full flex flex-col animate-in fade-in duration-500">
              <div className="mb-8">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Synthetic Data Lab</h2>
                <p className="text-slate-500 font-medium">Multi-panel validation: Generating 10,000+ counterfactual scenarios.</p>
              </div>
              <div className="flex-1 bg-white p-10 rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <SynthesisView data={synthesisData} />
              </div>
            </div>
          )}
          
          {stage === AppStage.VERIFICATION && (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto">
              <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-indigo-100 w-full animate-in zoom-in-95 duration-500">
                <div className="flex items-center gap-6 mb-10">
                  <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-indigo-600/20 animate-pulse">
                    <Lock className="text-white" size={32}/>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Truth-Gating Audit</h2>
                    <p className="text-slate-500 font-bold text-sm uppercase tracking-widest mt-1">Formal verification in progress</p>
                  </div>
                </div>
                <div className="space-y-4">
                   {verificationChecks.map((check, i) => (
                     <div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 border border-slate-100 animate-in slide-in-from-left-4 fade-in duration-500" style={{animationDelay: `${i*250}ms`}}>
                       <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900">{check.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">{check.message}</span>
                       </div>
                       <div className="flex items-center gap-3">
                         {check.status === 'Pass' && <div className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-100">PASS <CheckCircle2 size={12}/></div>}
                         {check.status === 'Fail' && <div className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-red-100">FAIL <XCircle size={12}/></div>}
                         {check.status === 'Warn' && <div className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-amber-100">WARN <AlertTriangle size={12}/></div>}
                       </div>
                     </div>
                   ))}
                   {verificationChecks.length === 0 && (
                     <div className="text-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mx-auto mb-4"></div>
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Compiling Formal Logic...</p>
                     </div>
                   )}
                </div>
              </div>
            </div>
          )}

          {stage === AppStage.REPORT && report && (
            <ReportView report={report} />
          )}
        </div>
      </main>
    </div>
  );
}
