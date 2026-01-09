
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { CausalGraphData, CausalNode, CausalEdge } from '../types';
import { ZoomIn, ZoomOut, Maximize, Sparkles, X, PlayCircle, StopCircle, Info, Activity } from 'lucide-react';

interface CausalViewProps {
  data: CausalGraphData;
  onUpdate: (newData: CausalGraphData) => void;
  onExpandNode: (nodeId: string) => Promise<void>;
  isExpanding?: boolean;
}

const CausalView: React.FC<CausalViewProps> = ({ data, onUpdate, onExpandNode, isExpanding }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [simulationMode, setSimulationMode] = useState(false);
  const [nodeValues, setNodeValues] = useState<Record<string, number>>({});
  const simulationRef = useRef<d3.Simulation<CausalNode & d3.SimulationNodeDatum, undefined> | null>(null);

  useEffect(() => {
    if (!simulationMode || !data?.nodes) return;
    if (Object.keys(nodeValues).length === 0) {
      const init: Record<string, number> = {};
      data.nodes.forEach(n => { init[n.id] = n.currentValue || 0.5; });
      setNodeValues(init);
      return;
    }
    const newValues = { ...nodeValues };
    data.nodes.forEach(n => { if (n.type !== 'intervention') newValues[n.id] = 0; });
    for(let i=0; i<3; i++) {
        (data.edges || []).forEach(e => {
            const sourceVal = newValues[e.source] ?? 0.5;
            const weight = e.weight ?? (e.relationship === 'negative' ? -0.5 : 0.5);
            newValues[e.target] = (newValues[e.target] || 0) + (sourceVal * weight);
        });
        data.nodes.forEach(n => {
            if (n.type !== 'intervention') {
                let v = newValues[n.id] + 0.5;
                newValues[n.id] = Math.max(0, Math.min(1, v));
            }
        });
    }
  }, [simulationMode, data?.edges, nodeValues, data?.nodes]); 

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.append("defs").selectAll("marker")
      .data(["end"]).enter().append("marker")
      .attr("id", "arrow").attr("viewBox", "0 -5 10 10").attr("refX", 25).attr("refY", 0)
      .attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
      .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#94a3b8");
    const g = svg.append("g").attr("class", "graph-container");
    g.append("g").attr("class", "links");
    g.append("g").attr("class", "nodes");
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setTransform(event.transform);
      });
    svg.call(zoom);
    return () => { simulationRef.current?.stop(); };
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data?.nodes) return;
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;
    const nodes = (data.nodes || []).map(d => ({ ...d })) as (CausalNode & d3.SimulationNodeDatum)[];
    const links = (data.edges || []).map(d => ({ ...d })) as (CausalEdge & d3.SimulationLinkDatum<CausalNode & d3.SimulationNodeDatum>)[];
    const svg = d3.select(svgRef.current);
    const g = svg.select(".graph-container");
    const linkGroup = g.select(".links");
    const nodeGroup = g.select(".nodes");
    if (!simulationRef.current) {
      simulationRef.current = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id((d: any) => d.id).distance(150))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(40));
    } else {
      const oldNodes = simulationRef.current.nodes();
      nodes.forEach(n => {
        const old = oldNodes.find(o => o.id === n.id);
        if (old) { n.x = old.x; n.y = old.y; n.vx = old.vx; n.vy = old.vy; }
      });
      simulationRef.current.nodes(nodes);
      (simulationRef.current.force("link") as d3.ForceLink<any, any>).links(links);
      if(!simulationMode) simulationRef.current.alpha(0.3).restart();
    }
    const link = linkGroup.selectAll<SVGLineElement, any>("line").data(links, (d) => `${(d.source as any).id || d.source}-${(d.target as any).id || d.target}`);
    const linkEnter = link.enter().append("line").attr("stroke", "#94a3b8").attr("stroke-opacity", 0.6).attr("marker-end", "url(#arrow)");
    link.exit().remove();
    const linkMerge = linkEnter.merge(link);
    linkMerge.attr("stroke-width", (d) => simulationMode ? 2 + Math.abs(d.weight || 0.5) * 4 : 2)
      .attr("stroke", (d) => !simulationMode ? "#94a3b8" : ((d.weight || 0) > 0 ? "#10b981" : "#ef4444"))
      .attr("stroke-dasharray", simulationMode ? "4 2" : "none");
    const node = nodeGroup.selectAll<SVGGElement, any>("g").data(nodes, (d) => d.id);
    const nodeEnter = node.enter().append("g").attr("cursor", "pointer")
      .call(d3.drag<SVGGElement, any>().on("start", dragstarted).on("drag", dragged).on("end", dragended));
    nodeEnter.append("circle").attr("stroke", "#fff").attr("stroke-width", 2);
    nodeEnter.append("text").attr("x", 22).attr("y", 5).attr("font-size", "11px").attr("font-weight", "600").attr("fill", "#334155").style("pointer-events", "none");
    nodeEnter.append("text").attr("class", "sim-value").attr("x", 0).attr("y", 4).attr("text-anchor", "middle").attr("fill", "white").attr("font-size", "9px").attr("font-weight", "bold").style("pointer-events", "none");
    node.exit().remove();
    const nodeMerge = nodeEnter.merge(node);
    nodeMerge.select("circle").attr("r", (d) => simulationMode ? 15 + ((nodeValues[d.id] ?? 0.5) * 15) : 18)
      .attr("fill", (d) => {
        if (d.type === 'intervention') return '#0ea5e9';
        if (d.type === 'outcome') return simulationMode ? d3.interpolateReds(nodeValues[d.id] ?? 0.5) : '#ef4444';
        return simulationMode ? d3.interpolateGreys(nodeValues[d.id] ?? 0.5) : '#64748b';
      }).attr("stroke", (d) => d.id === selectedNodeId ? "#6366f1" : "#fff").attr("stroke-width", (d) => d.id === selectedNodeId ? 3 : 2);
    nodeMerge.select("text").text((d) => d.label);
    nodeMerge.select(".sim-value").style("opacity", simulationMode ? 1 : 0).text((d) => (nodeValues[d.id] ?? 0.5).toFixed(2));
    nodeMerge.on("click", (event, d) => { event.stopPropagation(); setSelectedNodeId(d.id); });
    svg.on("click", () => setSelectedNodeId(null));
    simulationRef.current.on("tick", () => {
      linkMerge.attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y).attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
      nodeMerge.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });
    function dragstarted(event: any, d: any) { if (!event.active) simulationRef.current?.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; setSelectedNodeId(d.id); }
    function dragged(event: any, d: any) { d.fx = event.x; d.fy = event.y; }
    function dragended(event: any, d: any) { if (!event.active) simulationRef.current?.alphaTarget(0); d.fx = null; d.fy = null; }
  }, [data, selectedNodeId, simulationMode, nodeValues]);

  const handleSimValueChange = (id: string, newVal: number) => setNodeValues({ ...nodeValues, [id]: newVal });
  const handleZoom = (factor: number) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const newScale = transform.k * factor;
    svg.transition().duration(300).call(d3.zoom().transform as any, d3.zoomIdentity.translate(transform.x, transform.y).scale(newScale));
  };
  const selectedNode = (data?.nodes || []).find(n => n.id === selectedNodeId);

  return (
    <div className="w-full h-full relative group bg-slate-50 overflow-hidden">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing">
        <svg ref={svgRef} className="w-full h-full"></svg>
      </div>

      {/* COMPACT CONTROL STACK (BOTTOM LEFT) */}
      <div className="absolute bottom-28 left-8 z-50 flex flex-col gap-4 pointer-events-none w-72">
        
        {/* Node Inspector (Contextual) */}
        {selectedNode && !simulationMode && (
          <div className="bg-white/95 backdrop-blur-md p-5 rounded-[2rem] shadow-2xl border border-slate-200 pointer-events-auto animate-in slide-in-from-bottom-2 fade-in">
             <div className="flex justify-between items-center mb-4">
               <h3 className="font-black text-slate-900 text-xs uppercase tracking-widest flex items-center gap-2">
                 <Info size={14} className="text-indigo-500" /> Inspector
               </h3>
               <button onClick={() => setSelectedNodeId(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><X size={14}/></button>
             </div>
             <div className="space-y-4">
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Variable</label>
                  <div className="text-sm font-bold text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-100">{selectedNode.label}</div>
               </div>
               <button onClick={() => onExpandNode(selectedNode.id)} disabled={isExpanding} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/10">
                 {isExpanding ? <div className="animate-spin w-3 h-3 border-2 border-white rounded-full border-t-transparent"></div> : <Sparkles size={14} />}
                 Expand Mechanism
               </button>
             </div>
          </div>
        )}

        {/* Simulation Sliders (Contextual) */}
        {simulationMode && data?.nodes && (
          <div className="bg-white/95 backdrop-blur-md p-5 rounded-[2rem] shadow-2xl border border-indigo-100 pointer-events-auto animate-in slide-in-from-bottom-2 fade-in max-h-64 overflow-y-auto">
              <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Activity size={14}/> Live Interventions
              </h3>
              <div className="space-y-4">
                {data.nodes.filter(n => n.type === 'intervention').map(n => (
                  <div key={n.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex justify-between mb-2">
                          <span className="text-[10px] font-bold text-slate-700 truncate mr-2">{n.label}</span>
                          <span className="text-[10px] font-black text-indigo-600">{(nodeValues[n.id] ?? 0.5).toFixed(2)}</span>
                      </div>
                      <input type="range" min="0" max="1" step="0.01" value={nodeValues[n.id] ?? 0.5} onChange={(e) => handleSimValueChange(n.id, parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                  </div>
                ))}
              </div>
          </div>
        )}

        {/* Legend + Mode Toggle (The Base) */}
        <div className="bg-white/90 backdrop-blur-md p-2 rounded-[2rem] shadow-xl border border-slate-200 pointer-events-auto flex items-center gap-2">
            <button 
               onClick={() => setSimulationMode(!simulationMode)}
               className={`flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${simulationMode ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-900 text-white hover:bg-indigo-600'}`}
            >
               {simulationMode ? <StopCircle size={14} /> : <PlayCircle size={14} />}
               {simulationMode ? 'Stop Sim' : 'Simulate'}
            </button>
            <div className="flex items-center gap-3 px-4 h-full border-l border-slate-200">
               <div className="w-3 h-3 rounded-full bg-sky-500" title="Intervention"></div>
               <div className="w-3 h-3 rounded-full bg-red-500" title="Outcome"></div>
               <div className="w-3 h-3 rounded-full bg-slate-500" title="Variable"></div>
            </div>
        </div>
      </div>

      {/* Top Right Controls (Zoom) */}
      <div className="absolute top-8 right-8 flex flex-col gap-2">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 p-1.5 flex flex-col gap-1">
          <button onClick={() => handleZoom(1.2)} className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-600" title="Zoom In"><ZoomIn size={18} /></button>
          <button onClick={() => handleZoom(0.8)} className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-600" title="Zoom Out"><ZoomOut size={18} /></button>
          <button onClick={() => { if (svgRef.current) d3.select(svgRef.current).transition().duration(750).call(d3.zoom().transform as any, d3.zoomIdentity.translate(0,0).scale(1)); }} className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-600" title="Reset View"><Maximize size={18} /></button>
        </div>
      </div>
    </div>
  );
};

export default CausalView;
