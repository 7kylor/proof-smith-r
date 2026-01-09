
import React, { useState } from 'react';
import { ComposedChart, Area, Scatter, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SimulationResult, HeatmapCell } from '../types';
import { ShieldCheck, Activity, GitBranch, Lock, Sparkles, Grid, Clock, BarChart2 } from 'lucide-react';

interface SynthesisViewProps {
  data: SimulationResult | null;
}

const SynthesisView: React.FC<SynthesisViewProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'dose' | 'time' | 'heatmap'>('dose');

  if (!data) return <div className="flex items-center justify-center h-full text-slate-400 font-black uppercase tracking-widest text-xs">Sim pending...</div>;

  const doseData = data.doseResponseData || [];
  const observed = doseData.filter(d => d.type === 'Observed');
  const synthetic = doseData.filter(d => d.type === 'Synthetic');
  const counterfactual = doseData.filter(d => d.type === 'Counterfactual');

  const HeatmapPlate = ({ cells }: { cells: HeatmapCell[] }) => {
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
                 <div key={`${r}${c}`} className="w-6 h-6 border border-white/50" style={{ backgroundColor: `rgba(79, 70, 229, ${val})` }} />
               );
             })}
           </div>
         ))}
         <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            <span>Low</span>
            <div className="w-24 h-1.5 bg-gradient-to-r from-slate-100 to-indigo-600 rounded-full"></div>
            <span>High Intensity</span>
         </div>
       </div>
     );
  };

  return (
    <div className="w-full h-full flex flex-col p-8 space-y-8 overflow-y-auto">
      <div className="flex flex-col gap-8 h-full">
        <div className="flex-1 flex flex-col min-h-[450px] border border-slate-100 rounded-[2rem] bg-white shadow-sm overflow-hidden">
           <div className="flex items-center border-b border-slate-50 px-6 h-16 shrink-0">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-4 mr-6">FIG 01.</h3>
              <div className="flex gap-2">
                {[
                  { id: 'dose', label: 'Dose', icon: BarChart2 },
                  { id: 'time', label: 'Time', icon: Clock },
                  { id: 'heatmap', label: 'Plate', icon: Grid }
                ].map(t => (
                  <button 
                    key={t.id} 
                    onClick={() => setActiveTab(t.id as any)} 
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tight transition-all flex items-center gap-2 ${activeTab === t.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-50 text-slate-500 hover:text-slate-800'}`}
                  >
                    <t.icon size={12}/> {t.label}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-4">
                 <div className="text-right">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-tighter">P-Value</span>
                    <span className={`text-xs font-black ${data.statistics?.pValue < 0.05 ? 'text-emerald-600' : 'text-slate-600'}`}>
                      {data.statistics?.pValue?.toExponential(2) || "N/A"}
                    </span>
                 </div>
              </div>
           </div>

           <div className="flex-1 p-8 bg-white relative">
             <ResponsiveContainer width="100%" height="100%">
               {activeTab === 'dose' ? (
                 <ComposedChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                   <XAxis type="number" dataKey="x" stroke="#cbd5e1" fontSize={10} tickLine={false} axisLine={false} />
                   <YAxis type="number" dataKey="y" stroke="#cbd5e1" fontSize={10} tickLine={false} axisLine={false} />
                   <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                   <Area type="monotone" data={data.bands || []} dataKey="upper" stroke="none" fill="#e0e7ff" fillOpacity={0.4} />
                   <Scatter name="Observed" data={observed} fill="#94a3b8" shape="circle" />
                   <Scatter name="Model" data={synthetic} fill="#4f46e5" shape="cross" />
                   <Scatter name="Counterfactual" data={counterfactual} fill="#ef4444" shape="diamond" />
                 </ComposedChart>
               ) : activeTab === 'time' ? (
                 <LineChart data={data.timeCourseData || []} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                    <XAxis dataKey="t" stroke="#cbd5e1" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#cbd5e1" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Line type="monotone" dataKey="control" stroke="#cbd5e1" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="treatment" stroke="#4f46e5" strokeWidth={4} dot={{r: 5, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2}} />
                 </LineChart>
               ) : (
                 <div className="w-full h-full flex items-center justify-center">
                    <HeatmapPlate cells={data.heatmapData || []} />
                 </div>
               )}
             </ResponsiveContainer>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="bg-gradient-to-br from-indigo-50/50 to-white border border-indigo-100 rounded-[2rem] p-8 shadow-sm">
             <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-4 flex items-center gap-2">
               <Sparkles size={14} className="text-indigo-600" /> Mechanistic Insight
             </h4>
             <p className="text-sm text-indigo-900 leading-relaxed font-serif italic italic font-medium">
               "{data.robustnessNarrative || "Analyzing causal stability..."}"
             </p>
           </div>

           <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm space-y-4">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
               <ShieldCheck size={14} className="text-emerald-600"/> Robustness Metrics
             </h4>
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl">
                   <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Bootstrap</span>
                   <span className="text-lg font-black text-slate-800">{data.robustness?.bootstrapStability ?? 0}%</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl">
                   <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Resilience</span>
                   <span className="text-lg font-black text-slate-800">{data.robustness?.domainShiftResilience ?? 0}%</span>
                </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SynthesisView;
