import React, { useState, useEffect, useRef } from 'react';
import { AppStage, CausalGraphData, RAGSource, SimulationResult, StructuredReport, VerificationCheck } from './types';
import { extractCausalScaffold, performCalibratedRAG, runSynthesis, generateReviewerReport, expandCausalNode, mergeGraphs, runVerificationGates, parameterizeScaffold } from './services/gemini';
import CausalView from './components/CausalView';
import SynthesisView from './components/SynthesisView';
import ReportView from './components/ReportView';
import { Sparkles, ShieldCheck, AlertTriangle, Info, UploadCloud, FileText, X, Link, Type, CheckCircle2, Lock, XCircle, ArrowLeft, RefreshCw, AlertCircle, PlayCircle, Calculator, Plus, Search, Trash2, Rocket } from 'lucide-react';

// Icons (Inline SVG for simplicity)
const BeakerSvg = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>;
const GraphSvg = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>;
const SearchSvg = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const ChipSvg = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>;
const DocSvg = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;

const steps = [
  { id: AppStage.INGEST, label: 'Ingest', icon: BeakerSvg },
  { id: AppStage.SCAFFOLD, label: 'Scaffold', icon: GraphSvg },
  { id: AppStage.RAG, label: 'Calibrate', icon: SearchSvg },
  { id: AppStage.SYNTHESIS, label: 'Synthesize', icon: ChipSvg },
  { id: AppStage.REPORT, label: 'Proof Bundle', icon: DocSvg },
];

export default function App() {
  const [stage, setStage] = useState<AppStage>(AppStage.INGEST);
  const [inputText, setInputText] = useState('');
  const [ingestMode, setIngestMode] = useState<'text' | 'url' | 'file'>('text');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // App Data State
  const [scaffold, setScaffold] = useState<CausalGraphData | null>(null);
  const [ragSources, setRagSources] = useState<RAGSource[]>([]);
  const [ragSearchTerm, setRagSearchTerm] = useState('');
  const [synthesisData, setSynthesisData] = useState<SimulationResult | null>(null);
  const [report, setReport] = useState<StructuredReport | null>(null);
  
  // Verification State
  const [verificationChecks, setVerificationChecks] = useState<VerificationCheck[]>([]);

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Handlers
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
      // Clear downstream
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
    // Explicitly invalidate downstream if structural changes happen
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

  // --- AUTOMATED PIPELINE HANDLER ---
  const handleAutoRun = async () => {
    if (!scaffold) return;
    if (isAutoRunning) return;
    
    setIsAutoRunning(true);
    setLoading(true);
    
    try {
      // 1. RAG
      showToast("Auto-Pilot: Calibrating Evidence...");
      const terms = scaffold.nodes.map(n => n.label).join(', ');
      const ragResults = await performCalibratedRAG(`Mechanisms linking ${terms}`);
      setRagSources(ragResults);
      setStage(AppStage.RAG);
      await new Promise(r => setTimeout(r, 2000)); // Visual pause

      // 2. Synthesis
      showToast("Auto-Pilot: Running Stress Tests...");
      const simResult = await runSynthesis(scaffold);
      setSynthesisData(simResult);
      setStage(AppStage.SYNTHESIS);
      await new Promise(r => setTimeout(r, 2000));

      // 3. Verification
      setStage(AppStage.VERIFICATION);
      const checks = await runVerificationGates(scaffold);
      setVerificationChecks(checks);
      await new Promise(r => setTimeout(r, 3000)); // Longer pause for "Checking"

      // 4. Report
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
    
    // Step 1: Run Verification Gates (Truth Gating)
    setStage(AppStage.VERIFICATION);
    try {
      const checks = await runVerificationGates(scaffold);
      setVerificationChecks(checks);
      
      // Delay to show the verification process visually
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 2: Generate Report
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
    if (isAutoRunning) return; // Disable nav during auto-run
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
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-slate-800 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">ProofSmith-R</h1>
          <p className="text-xs text-slate-400 mt-1">Mechanistic Auto-Scientist</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {steps.map((s, idx) => {
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-left ${
                  isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 
                  isAccessible ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 cursor-not-allowed'
                }`}
              >
                <s.icon />
                <span className="font-medium text-sm">{s.label}</span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </button>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-800 text-xs text-slate-500">
          Powered by Gemini 3.0 Pro & 2.5 Flash
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <div className="flex items-center gap-2">
            {stage !== AppStage.INGEST && (
               <button onClick={() => setStage(steps[Math.max(0, steps.findIndex(s => s.id === stage) - 1)].id as AppStage)} disabled={isAutoRunning} className="mr-2 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                 <ArrowLeft size={20} />
               </button>
            )}
            <span className="text-slate-400 font-mono text-xs uppercase tracking-wider">Current Protocol</span>
            <span className="text-slate-800 font-semibold">{scaffold ? 'Active Causal Model #1A' : 'New Investigation'}</span>
          </div>
          <div className="flex items-center gap-3">
             {loading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>}
             
             {/* Back Navigation Shortcuts */}
             {stage === AppStage.SCAFFOLD && !isAutoRunning && (
               <button onClick={() => setStage(AppStage.INGEST)} className="text-slate-500 hover:text-indigo-600 text-sm font-medium px-3 py-2">
                 Edit Input
               </button>
             )}
             {stage === AppStage.RAG && !isAutoRunning && (
               <button onClick={() => setStage(AppStage.SCAFFOLD)} className="text-slate-500 hover:text-indigo-600 text-sm font-medium px-3 py-2">
                 Modify Model
               </button>
             )}

             {/* Primary Actions */}
             {stage === AppStage.INGEST && !scaffold && (
               <button onClick={handleIngestReplace} disabled={loading || !inputText} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50">
                 {ingestMode === 'url' ? 'Fetch & Analyze' : 'Analyze Content'}
               </button>
             )}
             
             {/* Auto-Pilot Button */}
             {scaffold && !isAutoRunning && stage !== AppStage.REPORT && (
                <button 
                  onClick={handleAutoRun}
                  disabled={loading}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-4 py-2 rounded-md text-sm font-bold shadow-md shadow-indigo-200 transition-all flex items-center gap-2 animate-in fade-in zoom-in-95"
                >
                   <Rocket size={16} /> Auto-Pilot
                </button>
             )}
             {isAutoRunning && (
                <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-md text-sm font-bold border border-indigo-200 flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></div>
                   Auto-Pilot Active...
                </div>
             )}
             
             {/* Manual Step Actions (Hidden during Auto-Run) */}
             {!isAutoRunning && (
               <>
                 {stage === AppStage.SCAFFOLD && (
                   <div className="flex gap-2">
                       {/* Parameterize Button */}
                       <button onClick={handleParameterize} disabled={loading} className="bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                          <Calculator size={16} /> Equation Discovery
                       </button>
                       <button onClick={handleRAG} disabled={loading} className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                         <SearchSvg /> Calibrate Evidence
                       </button>
                   </div>
                 )}
                 {stage === AppStage.RAG && (
                   <button onClick={handleSynthesis} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                     <ChipSvg /> Run Stress Tests
                   </button>
                 )}
                 {stage === AppStage.SYNTHESIS && (
                   <button onClick={handleReport} disabled={loading} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                     <DocSvg /> Generate Proof Bundle
                   </button>
                 )}
               </>
             )}
          </div>
        </header>

        {/* Viewport */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          
          {/* STAGE: INGEST */}
          {stage === AppStage.INGEST && (
            <div className="max-w-3xl mx-auto">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Ingest Scientific Context</h2>
                <p className="text-slate-500 mb-6">Upload papers, paste abstracts, or provide URLs to begin the mechanistic reconstruction.</p>
                
                <div className="flex gap-2 mb-6 border-b border-slate-100">
                   <button onClick={() => setIngestMode('text')} className={`pb-3 px-4 text-sm font-medium flex items-center gap-2 transition-all ${ingestMode === 'text' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-slate-400 hover:text-slate-600 border-b-2 border-transparent'}`}><Type size={16}/> Text Abstract</button>
                   <button onClick={() => setIngestMode('url')} className={`pb-3 px-4 text-sm font-medium flex items-center gap-2 transition-all ${ingestMode === 'url' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-slate-400 hover:text-slate-600 border-b-2 border-transparent'}`}><Link size={16}/> URL / Links</button>
                   <button onClick={() => setIngestMode('file')} className={`pb-3 px-4 text-sm font-medium flex items-center gap-2 transition-all ${ingestMode === 'file' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-slate-400 hover:text-slate-600 border-b-2 border-transparent'}`}><UploadCloud size={16}/> Upload Files</button>
                </div>

                <div className="relative min-h-[200px]">
                  {ingestMode === 'file' ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-8 flex flex-col items-center justify-center transition-colors hover:bg-slate-50 hover:border-indigo-200 h-48">
                      {!selectedFile ? (
                        <>
                          <div className="bg-white p-4 rounded-full shadow-sm mb-4 text-indigo-500"><UploadCloud size={32} /></div>
                          <p className="text-sm font-medium text-slate-700">Click to upload or drag and drop</p>
                          <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileUpload} accept=".pdf,.csv,.json,.txt,.md" />
                        </>
                      ) : (
                        <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200 w-full max-w-sm">
                           <div className="bg-indigo-50 p-2 rounded text-indigo-600"><FileText size={24} /></div>
                           <div className="flex-1 overflow-hidden">
                             <p className="text-sm font-medium text-slate-800 truncate">{selectedFile.name}</p>
                           </div>
                           <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setInputText(''); }} className="text-slate-400 hover:text-red-500 p-1"><X size={18} /></button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <textarea 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={ingestMode === 'text' ? "Paste abstract/methodology text here..." : "Paste URLs here (one per line)..."}
                        className="w-full h-48 p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-slate-700 font-mono text-sm leading-relaxed"
                      />
                      <div className="absolute bottom-4 right-4 flex gap-2">
                        {!inputText && <button onClick={loadSample} className="text-xs text-indigo-600 hover:underline bg-indigo-50 px-2 py-1 rounded">Load Sample</button>}
                      </div>
                    </>
                  )}
                </div>
                
                {scaffold && (
                  <div className="mt-8 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300 bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                    <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                      <AlertCircle size={16} className="text-amber-500"/> 
                      Update Confirmation
                    </h3>
                    <p className="text-xs text-slate-600 mb-4">You have an active causal model. Modifying input data will require re-verifying downstream results.</p>
                    
                    <div className="flex gap-4">
                      <button onClick={handleIngestMerge} disabled={loading || !inputText} className="flex-1 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm">
                        <Sparkles size={16} className="text-indigo-500"/>
                        Merge with Existing
                        <span className="text-[10px] text-slate-400 font-normal ml-1">(Keep nodes)</span>
                      </button>
                      <button onClick={handleIngestReplace} disabled={loading || !inputText} className="flex-1 bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 hover:border-red-200 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm">
                        <RefreshCw size={16} className="text-slate-400 group-hover:text-red-400"/>
                        Replace Entire Model
                        <span className="text-[10px] text-slate-400 font-normal ml-1">(Reset all)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STAGE: SCAFFOLD */}
          {stage === AppStage.SCAFFOLD && scaffold && (
            <div className="h-full flex flex-col">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-slate-900">Causal Scaffold</h2>
                <p className="text-slate-500">Interactive Model: Parameterize equations, run simulations, or expand via Gemini.</p>
              </div>
              <div className="flex-1 bg-white rounded-xl shadow-lg border border-slate-200 relative overflow-hidden">
                <CausalView data={scaffold} onUpdate={handleScaffoldUpdate} onExpandNode={handleExpandNode} isExpanding={isExpanding} />
              </div>
            </div>
          )}

          {/* STAGE: RAG */}
          {stage === AppStage.RAG && (
            <div className="max-w-4xl mx-auto space-y-6">
               <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Calibrated Evidence Retrieval</h2>
                  <p className="text-slate-500">Retrieval Augmented Generation with confidence bands based on method quality and semantic fit.</p>
                </div>
              </div>

              {/* Discovery Bar */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      value={ragSearchTerm}
                      onChange={(e) => setRagSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRAGSearch()}
                      placeholder="Search for specific mechanisms, proteins, or papers to add evidence..."
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <button 
                    onClick={handleRAGSearch}
                    disabled={loading || !ragSearchTerm}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {loading ? <div className="animate-spin w-4 h-4 border-2 border-white rounded-full border-t-transparent"></div> : <Plus size={18} />}
                    Add Evidence
                  </button>
                </div>
                
                {/* Suggestion Chips */}
                {scaffold && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Quick Add:</span>
                    {scaffold.nodes.slice(0, 6).map(node => (
                      <button 
                        key={node.id}
                        onClick={() => {
                          const term = `Evidence for ${node.label}`;
                          setRagSearchTerm(term);
                          // Optional: Auto-search
                        }}
                        className="px-2 py-1 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded text-xs transition-colors"
                      >
                        {node.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {ragSources.length === 0 ? (
                 <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200">
                    <AlertTriangle className="mx-auto text-amber-400 mb-4" size={32} />
                    <h3 className="text-lg font-medium text-slate-800">Evidence Needed</h3>
                    <p className="text-slate-500 mb-6">Model structure has changed. Please recalibrate evidence.</p>
                    <button onClick={handleRAG} className="bg-sky-600 text-white px-6 py-2 rounded-full font-medium shadow-lg shadow-sky-200 hover:bg-sky-700 transition-colors">
                      Run Calibration
                    </button>
                 </div>
              ) : (
                <div className="grid gap-4">
                  {ragSources.map((source, i) => (
                    <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 hover:shadow-md transition-all duration-300 flex justify-between items-start group relative">
                      {/* Dismiss Button */}
                      <button 
                        onClick={() => handleDismissSource(i)}
                        className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        title="Dismiss Source"
                      >
                        <Trash2 size={16} />
                      </button>

                      <div className="flex-1 pr-10">
                        <div className="flex items-center gap-2 mb-2">
                           {source.methodQuality === 'High' && <ShieldCheck className="text-emerald-500" size={18} />}
                           {source.methodQuality === 'Medium' && <Info className="text-amber-500" size={18} />}
                           {source.methodQuality === 'Low' && <AlertTriangle className="text-red-500" size={18} />}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${source.methodQuality === 'High' ? 'bg-emerald-50 text-emerald-700' : source.methodQuality === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{source.methodQuality} Quality</span>
                        </div>
                        <h3 className="font-semibold text-slate-800 text-lg leading-tight hover:text-indigo-600 cursor-pointer transition-colors pr-4">{source.title}</h3>
                        <p className="text-sm text-slate-500 mt-2 leading-relaxed">{source.snippet}</p>
                        <div className="mt-4 flex items-start gap-3 bg-slate-50 rounded-lg p-3 border border-slate-100">
                           <Sparkles className="text-indigo-500 mt-0.5 flex-shrink-0" size={16} />
                           <div>
                             <span className="block text-xs font-bold text-indigo-900 mb-0.5">Gemini Calibration Insight</span>
                             <p className="text-xs text-slate-600">{source.confidenceReason}</p>
                           </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-center justify-center min-w-[100px] pl-4 border-l border-slate-100">
                        <div className="relative w-20 h-20">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                            <path className="transition-all duration-1000 ease-out" strokeDasharray={`${source.confidenceScore}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={source.confidenceScore > 80 ? '#10b981' : source.confidenceScore > 50 ? '#f59e0b' : '#ef4444'} strokeWidth="3" strokeLinecap="round" />
                          </svg>
                          <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
                            <span className={`text-xl font-bold ${source.confidenceScore > 80 ? 'text-emerald-600' : source.confidenceScore > 50 ? 'text-amber-600' : 'text-red-600'}`}>{source.confidenceScore}</span>
                            <span className="text-[9px] uppercase font-bold text-slate-400">Score</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STAGE: SYNTHESIS */}
          {stage === AppStage.SYNTHESIS && (
             <div className="h-full flex flex-col">
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-slate-900">Synthetic Data Lab</h2>
                <p className="text-slate-500">Multi-panel validation: Dose-response, time-course dynamics, and simulated high-content imaging.</p>
              </div>
              <div className="flex-1 bg-white p-6 rounded-xl shadow-lg border border-slate-200">
                <SynthesisView data={synthesisData} />
              </div>
            </div>
          )}
          
          {/* STAGE: VERIFICATION (Intermediate) */}
          {stage === AppStage.VERIFICATION && (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto">
              <div className="bg-white p-8 rounded-2xl shadow-xl border border-indigo-100 w-full">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-indigo-600 rounded-full animate-pulse">
                    <Lock className="text-white" size={24}/>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Running Truth-Gating Audit...</h2>
                    <p className="text-slate-500 text-sm">Validating Unit Consistency, Leakage, and Bounds.</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                   {verificationChecks.map((check, i) => (
                     <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 animate-in slide-in-from-left-2 fade-in duration-500" style={{animationDelay: `${i*200}ms`}}>
                       <span className="text-sm font-medium text-slate-700">{check.name}</span>
                       <div className="flex items-center gap-2">
                         <span className="text-xs text-slate-500">{check.message}</span>
                         {check.status === 'Pass' && <CheckCircle2 className="text-emerald-500" size={18}/>}
                         {check.status === 'Fail' && <XCircle className="text-red-500" size={18}/>}
                         {check.status === 'Warn' && <AlertTriangle className="text-amber-500" size={18}/>}
                       </div>
                     </div>
                   ))}
                   {verificationChecks.length === 0 && (
                     <div className="text-center py-4 text-slate-400 text-sm italic">Analyzing logical structure...</div>
                   )}
                </div>
              </div>
            </div>
          )}

          {/* STAGE: REPORT */}
          {stage === AppStage.REPORT && report && (
            <ReportView report={report} />
          )}

        </div>
      </main>
    </div>
  );
}