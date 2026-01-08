import React, { useRef } from 'react';
import { StructuredReport, ClaimCard, Artifact } from '../types';
import { CheckCircle2, AlertTriangle, XCircle, FileCode, Database, FileJson, ArrowRight, Download, Code, Copy, X, Printer, Share2 } from 'lucide-react';

interface ReportViewProps {
  report: StructuredReport;
}

const ReportView: React.FC<ReportViewProps> = ({ report }) => {
  const [selectedArtifact, setSelectedArtifact] = React.useState<Artifact | null>(null);
  
  const handleExport = () => {
    const dataStr = JSON.stringify(report, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proof-bundle-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // A4 Layout container style
  return (
    <div className="w-full bg-slate-100 min-h-full py-8 overflow-y-auto print:bg-white print:p-0">
      
      {/* Toolbar - Hidden in Print */}
      <div className="max-w-[210mm] mx-auto mb-6 flex justify-between items-center print:hidden px-4 md:px-0">
         <div className="text-sm text-slate-500 font-medium">ProofSmith-R / Generated Report</div>
         <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 text-sm hover:bg-slate-50 font-medium transition-colors shadow-sm">
               <Printer size={16}/> Print / PDF
            </button>
            <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 border border-indigo-600 rounded-lg text-white text-sm hover:bg-indigo-700 font-medium transition-colors shadow-sm">
               <Download size={16}/> Export Bundle
            </button>
         </div>
      </div>

      {/* The Paper Document */}
      <div className="max-w-[210mm] mx-auto bg-white min-h-[297mm] shadow-2xl print:shadow-none print:w-full print:max-w-none rounded-none md:rounded-xl overflow-hidden text-slate-900 font-serif">
         
         {/* Document Header */}
         <div className="bg-slate-900 text-white p-12 print:p-8 print:bg-white print:text-black print:border-b-2 print:border-black">
            <div className="flex justify-between items-start">
               <div>
                  <h1 className="text-4xl font-bold font-sans tracking-tight mb-2">Mechanistic Proof Report</h1>
                  <p className="text-slate-400 print:text-slate-600 text-sm font-sans uppercase tracking-widest">Confidential • Reviewer Mode</p>
               </div>
               <div className="text-right hidden print:block">
                  <p className="text-sm font-bold">ProofSmith-R</p>
                  <p className="text-xs text-slate-500">{new Date().toLocaleDateString()}</p>
               </div>
            </div>
            
            {/* Stats Row in Header */}
            <div className="grid grid-cols-3 gap-8 mt-10 border-t border-slate-700 pt-8 print:border-slate-200">
               <div>
                  <div className="text-3xl font-bold font-sans">{report.scores?.validity}%</div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 print:text-slate-600 mt-1">Validity Score</div>
               </div>
               <div>
                  <div className="text-3xl font-bold font-sans">{report.scores?.reproducibility}%</div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 print:text-slate-600 mt-1">Reproducibility</div>
               </div>
               <div>
                  <div className="text-3xl font-bold font-sans">{report.scores?.robustness}%</div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 print:text-slate-600 mt-1">Robustness</div>
               </div>
            </div>
         </div>

         <div className="p-12 print:p-8 space-y-10">
            
            {/* Executive Summary */}
            <section>
               <h2 className="text-lg font-bold font-sans text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 mb-4">Executive Summary</h2>
               <p className="text-base leading-relaxed text-slate-800 font-serif">
                  {report.summary || "No summary generated."}
               </p>
            </section>

            {/* Evidence & Claims */}
            <section>
               <h2 className="text-lg font-bold font-sans text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 mb-4">Verified Scientific Claims</h2>
               <div className="grid grid-cols-1 gap-4">
                  {(report.claims || []).map((c, i) => (
                     <div key={i} className="flex gap-4 items-start">
                        <div className="mt-1">
                           {c.verdict === 'Supported' && <CheckCircle2 className="text-emerald-600" size={18} />}
                           {c.verdict === 'Disputed' && <XCircle className="text-red-600" size={18} />}
                           {c.verdict === 'Pending' && <AlertTriangle className="text-amber-600" size={18} />}
                        </div>
                        <div>
                           <p className="font-medium text-slate-900 leading-snug">{c.claim}</p>
                           <p className="text-xs text-slate-500 mt-1 italic font-serif">Source: {c.citation}</p>
                        </div>
                     </div>
                  ))}
               </div>
            </section>

            {/* Protocol Diffs */}
            <section>
               <h2 className="text-lg font-bold font-sans text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 mb-4">Protocol Specification Corrections</h2>
               <div className="border border-slate-200 rounded-lg overflow-hidden text-sm">
                  <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 font-sans font-bold py-2 px-4 text-slate-700">
                     <div className="col-span-5">Original Method</div>
                     <div className="col-span-2 text-center text-slate-400"><ArrowRight size={16} className="inline"/></div>
                     <div className="col-span-5">Corrected Protocol</div>
                  </div>
                  {(report.protocolDiffs || []).map((diff, i) => (
                     <div key={i} className="grid grid-cols-12 border-b border-slate-100 last:border-0 p-4 items-center">
                        <div className="col-span-5 text-slate-600 font-mono text-xs leading-relaxed">{diff.original}</div>
                        <div className="col-span-2 flex justify-center text-slate-300"><ArrowRight size={14}/></div>
                        <div className="col-span-5 text-slate-900 font-mono text-xs leading-relaxed bg-emerald-50/50 p-2 rounded -my-2 border border-emerald-100/50">
                           {diff.corrected}
                           {diff.rationale && <div className="mt-2 text-[10px] text-emerald-700 font-sans italic border-t border-emerald-100 pt-1">{diff.rationale}</div>}
                        </div>
                     </div>
                  ))}
                  {(!report.protocolDiffs || report.protocolDiffs.length === 0) && (
                     <div className="p-4 text-center text-slate-400 italic">No protocol changes required.</div>
                  )}
               </div>
            </section>

            {/* Artifacts - Footer */}
            <section className="print:hidden">
               <h2 className="text-lg font-bold font-sans text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-2 mb-4">Digital Artifacts</h2>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {(report.artifacts || []).map((file, i) => (
                     <div 
                        key={i} 
                        onClick={() => file.type === 'code' && file.content ? setSelectedArtifact(file) : null}
                        className={`border border-slate-200 rounded-lg p-3 flex items-center gap-3 ${file.type === 'code' ? 'cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors' : 'opacity-70'}`}
                     >
                        <div className="p-2 bg-slate-100 rounded text-slate-500">
                           {file.type === 'code' ? <Code size={18}/> : file.type === 'dataset' ? <Database size={18}/> : <FileJson size={18}/>}
                        </div>
                        <div className="overflow-hidden">
                           <div className="font-mono text-xs font-bold text-slate-700 truncate">{file.name}</div>
                           <div className="text-[10px] text-slate-400">{file.size} • {file.type.toUpperCase()}</div>
                        </div>
                     </div>
                  ))}
               </div>
            </section>

         </div>
         
         {/* Footer */}
         <div className="bg-slate-50 p-8 border-t border-slate-200 text-center print:bg-white print:border-none">
            <p className="text-xs text-slate-400 font-sans">Generated by ProofSmith-R v2.0 • AI-Assisted Mechanistic Verification</p>
         </div>

      </div>

      {/* Code Modal */}
      {selectedArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden" onClick={() => setSelectedArtifact(null)}>
           <div className="bg-slate-900 w-full max-w-3xl h-[600px] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-700" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-900">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Code size={20}/></div>
                    <div>
                      <h3 className="font-mono text-white font-bold text-sm">{selectedArtifact.name}</h3>
                    </div>
                 </div>
                 <button onClick={() => setSelectedArtifact(null)} className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors">
                    <X size={18} />
                 </button>
              </div>
              <div className="flex-1 overflow-auto p-6 bg-[#0d1117]">
                 <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {selectedArtifact.content || "# No content available"}
                 </pre>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default ReportView;