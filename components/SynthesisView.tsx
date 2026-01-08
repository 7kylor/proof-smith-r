import React, { useState } from 'react';
import { ComposedChart, Area, Scatter, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SimulationResult, HeatmapCell } from '../types';
import { ShieldCheck, Activity, GitBranch, Lock, Sparkles, Grid, Clock, BarChart2 } from 'lucide-react';

interface SynthesisViewProps {
  data: SimulationResult | null;
}

const SynthesisView: React.FC<SynthesisViewProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'dose' | 'time' | 'heatmap'>('dose');

  if (!data) return <div className="flex items-center justify-center h-64 text-slate-400">No simulation data generated yet.</div>;

  // Defensive coding: Ensure arrays exist before filtering
  const doseData = data.doseResponseData || [];
  const observed = doseData.filter(d => d.type === 'Observed');
  const synthetic = doseData.filter(d => d.type === 'Synthetic');
  const counterfactual = doseData.filter(d => d.type === 'Counterfactual');

  // Heatmap Renderer
  const HeatmapPlate = ({ cells }: { cells: HeatmapCell[] }) => {
     // 8 rows (A-H), 12 cols (1-12)
     const rows = ['A','B','C','D','E','F','G','H'];
     const cols = Array.from({length: 12}, (_, i) => i + 1);
     const safeCells = cells || [];
     
     return (
       <div className="flex flex-col items-center">
         <div className="flex mb-1">
           <div className="w-6"></div>
           {cols.map(c => <div key={c} className="w-6 text-[10px] text-center text-slate-400 font-mono">{c}</div>)}
         </div>
         {rows.map(r => (
           <div key={r} className="flex mb-1">
             <div className="w-6 text-[10px] text-right pr-2 text-slate-400 font-mono flex items-center justify-end">{r}</div>
             {cols.map(c => {
               const cell = safeCells.find(x => x.row === r && x.col === c);
               const val = cell ? cell.value : 0;
               return (
                 <div 
                   key={`${r}${c}`} 
                   className="w-6 h-6 border border-white/50 relative group"
                   style={{ backgroundColor: `rgba(79, 70, 229, ${val})` }} // Indigo scale
                 >
                   <div className="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-1 rounded pointer-events-none whitespace-nowrap z-10">
                     {r}{c}: {val.toFixed(2)}
                   </div>
                 </div>
               );
             })}
           </div>
         ))}
         <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <span>Low</span>
            <div className="w-24 h-2 bg-gradient-to-r from-white to-indigo-600 rounded-full"></div>
            <span>High Intensity</span>
         </div>
       </div>
     );
  };

  return (
    <div className="w-full h-full flex flex-col gap-6">
      
      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {/* Main Figure Area */}
        <div className="flex-1 flex flex-col min-h-[500px] border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
           {/* Figure Header / Tabs */}
           <div className="flex items-center border-b border-slate-100 px-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider py-4 mr-6">Figure 1.</h3>
              <div className="flex gap-1">
                <button onClick={() => setActiveTab('dose')} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'dose' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                   <BarChart2 size={14}/> Dose-Response
                </button>
                <button onClick={() => setActiveTab('time')} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'time' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                   <Clock size={14}/> Time-Course
                </button>
                <button onClick={() => setActiveTab('heatmap')} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'heatmap' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                   <Grid size={14}/> HCS Plate
                </button>
              </div>
              <div className="ml-auto flex items-center gap-4 text-xs">
                 <div className="flex flex-col items-end">
                    <span className="text-slate-400 font-mono">P-Value</span>
                    <span className={`font-bold ${data.statistics?.pValue < 0.05 ? 'text-emerald-600' : 'text-slate-600'}`}>
                      {data.statistics?.pValue?.toExponential(2) || "N/A"}
                    </span>
                 </div>
                 <div className="w-px h-6 bg-slate-100"></div>
                 <div className="flex flex-col items-end">
                    <span className="text-slate-400 font-mono">Effect Size</span>
                    <span className="font-bold text-slate-600">{data.statistics?.effectSize?.toFixed(2) || "N/A"}</span>
                 </div>
              </div>
           </div>

           {/* Chart Content - Fixed min-height to prevent errors */}
           <div className="flex-1 p-6 bg-white relative h-full min-h-[400px]">
             <ResponsiveContainer width="100%" height="100%">
               {activeTab === 'dose' ? (
                 <ComposedChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                   <XAxis type="number" dataKey="x" name="Concentration" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'Concentration (log)', position: 'bottom', offset: 0, fontSize: 12 }} />
                   <YAxis type="number" dataKey="y" name="Response" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'Normalized Response', angle: -90, position: 'insideLeft', fontSize: 12 }}/>
                   <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                   <Legend verticalAlign="top" height={36} />
                   <Area type="monotone" data={data.bands || []} dataKey="upper" stroke="none" fill="#e0e7ff" fillOpacity={0.4} name="95% CI" />
                   <Scatter name="Observed" data={observed} fill="#64748b" shape="circle" />
                   <Scatter name="Model Fit" data={synthetic} fill="#4f46e5" shape="cross" />
                   <Scatter name="Counterfactual" data={counterfactual} fill="#ef4444" shape="diamond" />
                 </ComposedChart>
               ) : activeTab === 'time' ? (
                 <LineChart data={data.timeCourseData || []} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="t" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'Time (h)', position: 'bottom', offset: 0, fontSize: 12 }}/>
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'Response', angle: -90, position: 'insideLeft', fontSize: 12 }}/>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend verticalAlign="top" height={36} />
                    <Line type="monotone" dataKey="control" stroke="#94a3b8" strokeWidth={2} name="Control" dot={false} />
                    <Line type="monotone" dataKey="treatment" stroke="#4f46e5" strokeWidth={3} name="Treatment" dot={{r: 4}} />
                 </LineChart>
               ) : (
                 <div className="w-full h-full flex items-center justify-center">
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                       <h4 className="text-center text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest">Simulated High-Content Screening (Plate 1)</h4>
                       <HeatmapPlate cells={data.heatmapData || []} />
                    </div>
                 </div>
               )}
             </ResponsiveContainer>
           </div>
        </div>

        {/* Sidebar: Narrative & Stats */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
           {/* Insight Card */}
           <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl p-5 shadow-sm">
             <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-3 flex items-center gap-2">
               <Sparkles size={14} className="text-indigo-600" /> Scientific Interpretation
             </h4>
             <p className="text-sm text-indigo-900 leading-relaxed font-serif italic">
               "{data.robustnessNarrative || "Data indicates a significant treatment effect."}"
             </p>
           </div>

           {/* Robustness Scores */}
           <div className="bg-white rounded-xl border border-slate-200 p-5 flex-1">
             <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-5 flex items-center gap-2">
               <ShieldCheck size={14} className="text-emerald-600"/> Validation Metrics
             </h4>
             <div className="space-y-6">
                <div>
                   <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 flex items-center gap-1"><Activity size={12}/> Bootstrap Stability</span>
                      <span className="font-mono font-bold text-slate-800">{data.robustness?.bootstrapStability ?? 0}%</span>
                   </div>
                   <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{width: `${data.robustness?.bootstrapStability ?? 0}%`}}></div>
                   </div>
                </div>
                <div>
                   <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 flex items-center gap-1"><GitBranch size={12}/> Domain Shift</span>
                      <span className="font-mono font-bold text-slate-800">{data.robustness?.domainShiftResilience ?? 0}%</span>
                   </div>
                   <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{width: `${data.robustness?.domainShiftResilience ?? 0}%`}}></div>
                   </div>
                </div>
                <div>
                   <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600 flex items-center gap-1"><Lock size={12}/> Identifiability</span>
                      <span className="font-mono font-bold text-indigo-600">{data.robustness?.identifiability ?? "Unknown"}</span>
                   </div>
                </div>
             </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default SynthesisView;