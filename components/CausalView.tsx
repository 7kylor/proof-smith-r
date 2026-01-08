import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { CausalGraphData, CausalNode, CausalEdge } from '../types';
import { ZoomIn, ZoomOut, Maximize, Plus, Sparkles, Trash2, X, MousePointer2, PlayCircle, StopCircle, Sliders } from 'lucide-react';

interface CausalViewProps {
  data: CausalGraphData;
  onUpdate: (newData: CausalGraphData) => void;
  onExpandNode: (nodeId: string) => Promise<void>;
  isExpanding?: boolean;
}

const CausalView: React.FC<CausalViewProps> = ({ data, onUpdate, onExpandNode, isExpanding }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Interaction State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [simulationMode, setSimulationMode] = useState(false);
  
  // Simulation State
  const [nodeValues, setNodeValues] = useState<Record<string, number>>({});

  // Internal D3 State preservation
  const simulationRef = useRef<d3.Simulation<CausalNode & d3.SimulationNodeDatum, undefined> | null>(null);

  // --- Real-time Propagation Logic ---
  useEffect(() => {
    if (!simulationMode) return;
    
    // Initialize values if missing
    if (Object.keys(nodeValues).length === 0) {
      const init: Record<string, number> = {};
      data.nodes.forEach(n => { init[n.id] = n.currentValue || 0.5; });
      setNodeValues(init);
      return;
    }

    // Topological propagation (Simple iterative approx for cyclic/DAG mixed)
    const newValues = { ...nodeValues };
    const edges = data.edges;
    
    // Reset non-intervention nodes before calculating
    data.nodes.forEach(n => {
      if (n.type !== 'intervention') newValues[n.id] = 0; 
    });

    // 3 passes for propagation depth
    for(let i=0; i<3; i++) {
        edges.forEach(e => {
            const sourceVal = newValues[e.source] ?? 0.5;
            const weight = e.weight ?? (e.relationship === 'negative' ? -0.5 : 0.5);
            // Simple linear additive model
            const contribution = sourceVal * weight;
            newValues[e.target] = (newValues[e.target] || 0) + contribution;
        });
        
        // Normalize/Clamp values 0-1 for visual sanity
        data.nodes.forEach(n => {
            if (n.type !== 'intervention') {
                let v = newValues[n.id];
                v = v + 0.5; 
                newValues[n.id] = Math.max(0, Math.min(1, v));
            }
        });
    }
    
  }, [simulationMode, data.edges]); 


  // Initial D3 Setup
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Hard clear

    // Define Arrow Marker
    svg.append("defs").selectAll("marker")
      .data(["end"])
      .enter().append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#94a3b8");

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
    
    // Cleanup on unmount
    return () => {
        simulationRef.current?.stop();
    };

  }, []);

  // Update Graph when Data Changes OR Simulation Values Change
  useEffect(() => {
    if (!svgRef.current || !data) return;

    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    const nodes = data.nodes.map(d => ({ ...d })) as (CausalNode & d3.SimulationNodeDatum)[];
    const links = data.edges.map(d => ({ ...d })) as (CausalEdge & d3.SimulationLinkDatum<CausalNode & d3.SimulationNodeDatum>)[];

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
      // Keep positions if stable
      const oldNodes = simulationRef.current.nodes();
      nodes.forEach(n => {
        const old = oldNodes.find(o => o.id === n.id);
        if (old) { n.x = old.x; n.y = old.y; n.vx = old.vx; n.vy = old.vy; }
      });
      
      simulationRef.current.nodes(nodes);
      (simulationRef.current.force("link") as d3.ForceLink<any, any>).links(links);
      if(!simulationMode) simulationRef.current.alpha(0.3).restart();
    }

    // Render Links
    const link = linkGroup.selectAll<SVGLineElement, any>("line")
      .data(links, (d) => `${(d.source as any).id || d.source}-${(d.target as any).id || d.target}`);

    const linkEnter = link.enter().append("line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrow)");

    link.exit().remove();
    const linkMerge = linkEnter.merge(link);

    // Dynamic Style for Simulation
    linkMerge
      .attr("stroke-width", (d) => {
        const w = Math.abs(d.weight || 0.5);
        return simulationMode ? 2 + w * 4 : Math.sqrt(d.strength || 2) * 2;
      })
      .attr("stroke", (d) => {
         if (!simulationMode) return "#94a3b8";
         return (d.weight || 0) > 0 ? "#10b981" : "#ef4444"; // Green pos, Red neg
      })
      .attr("stroke-dasharray", simulationMode ? "4 2" : "none");

    // Render Nodes
    const node = nodeGroup.selectAll<SVGGElement, any>("g")
      .data(nodes, (d) => d.id);

    const nodeEnter = node.enter().append("g")
      .attr("cursor", "pointer")
      .call(d3.drag<SVGGElement, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    nodeEnter.append("circle")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    nodeEnter.append("text")
      .attr("x", 22)
      .attr("y", 5)
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("fill", "#1e293b")
      .style("pointer-events", "none");
    
    // Add value label for simulation
    nodeEnter.append("text")
      .attr("class", "sim-value")
      .attr("x", 0)
      .attr("y", 4)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .style("pointer-events", "none")
      .style("opacity", 0);

    node.exit().remove();
    const nodeMerge = nodeEnter.merge(node);

    // Node Styling with Simulation Feedback
    nodeMerge.select("circle")
      .attr("r", (d) => {
        if (!simulationMode) return 18;
        // Pulse size based on value
        const val = nodeValues[d.id] ?? 0.5;
        return 15 + (val * 15); // 15 to 30 radius
      })
      .attr("fill", (d) => {
        if (d.type === 'intervention') return '#0ea5e9';
        if (d.type === 'outcome') {
            if(simulationMode) {
               const val = nodeValues[d.id] ?? 0.5;
               return d3.interpolateReds(val);
            }
            return '#ef4444';
        }
        if(simulationMode) {
            const val = nodeValues[d.id] ?? 0.5;
            return d3.interpolateGreys(val); 
        }
        return '#64748b';
      })
      .attr("stroke", (d) => d.id === selectedNodeId ? "#6366f1" : "#fff")
      .attr("stroke-width", (d) => d.id === selectedNodeId ? 3 : 2);

    nodeMerge.select("text").text((d) => d.label);
    
    nodeMerge.select(".sim-value")
        .style("opacity", simulationMode ? 1 : 0)
        .text((d) => {
           const val = nodeValues[d.id] ?? 0.5;
           return val.toFixed(2);
        });

    nodeMerge.on("click", (event, d) => {
      event.stopPropagation();
      setSelectedNodeId(d.id);
    });
    
    svg.on("click", () => setSelectedNodeId(null));

    simulationRef.current.on("tick", () => {
      linkMerge
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeMerge
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
      setSelectedNodeId(d.id);
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulationRef.current?.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

  }, [data, selectedNodeId, simulationMode, nodeValues]);


  // --- Logic for Simulation Update ---
  const handleSimValueChange = (id: string, newVal: number) => {
    const updated = { ...nodeValues, [id]: newVal };
    setNodeValues(updated);
  };

  // --- UI Handlers ---
  const handleZoom = (factor: number) => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const newScale = transform.k * factor;
    svg.transition().duration(300).call(
      // @ts-ignore
      d3.zoom().transform, 
      d3.zoomIdentity.translate(transform.x, transform.y).scale(newScale)
    );
  };
  
  const handleCenter = () => {
      if (!svgRef.current) return;
      const svg = d3.select(svgRef.current);
      // @ts-ignore
      svg.transition().duration(750).call(d3.zoom().transform, d3.zoomIdentity.translate(0,0).scale(1));
  };

  const selectedNode = data.nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="w-full h-full relative group">
      <div ref={containerRef} className="w-full h-full bg-slate-50 overflow-hidden cursor-grab active:cursor-grabbing">
        <svg ref={svgRef} className="w-full h-full"></svg>
      </div>

      {/* Mode Toggle Overlay */}
      <div className="absolute top-4 left-4 flex gap-4 pointer-events-none">
          {/* Legend */}
          <div className="bg-white/90 p-3 rounded-lg shadow-sm border border-slate-200 backdrop-blur-sm pointer-events-auto">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Graph Legend</h4>
            <div className="flex items-center gap-2 mb-1 text-xs text-slate-600"><div className="w-3 h-3 rounded-full bg-sky-500"></div> Intervention</div>
            <div className="flex items-center gap-2 mb-1 text-xs text-slate-600"><div className="w-3 h-3 rounded-full bg-red-500"></div> Outcome</div>
            <div className="flex items-center gap-2 text-xs text-slate-600"><div className="w-3 h-3 rounded-full bg-slate-500"></div> Variable</div>
          </div>
          
          {/* Simulation Toggle */}
          <div className="bg-white/90 p-1.5 rounded-lg shadow-sm border border-slate-200 backdrop-blur-sm pointer-events-auto flex gap-2">
             <button 
               onClick={() => setSimulationMode(!simulationMode)}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${
                 simulationMode 
                 ? 'bg-indigo-600 text-white shadow-inner' 
                 : 'bg-white text-slate-600 hover:bg-slate-100'
               }`}
             >
               {simulationMode ? <StopCircle size={16} /> : <PlayCircle size={16} />}
               {simulationMode ? 'Stop Sim' : 'Simulate'}
             </button>
          </div>
      </div>
      
      {/* Simulation Controls (Visible when Simulation Mode is ON) */}
      {simulationMode && (
          <div className="absolute top-20 left-4 w-64 space-y-2 animate-in slide-in-from-left-5 fade-in">
              {data.nodes.filter(n => n.type === 'intervention').map(n => (
                  <div key={n.id} className="bg-white/90 p-3 rounded-lg shadow-sm border border-indigo-100 backdrop-blur-sm">
                      <div className="flex justify-between mb-1">
                          <span className="text-xs font-bold text-slate-700">{n.label}</span>
                          <span className="text-xs text-indigo-600 font-mono">{(nodeValues[n.id] ?? 0.5).toFixed(2)}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="1" step="0.01"
                        value={nodeValues[n.id] ?? 0.5}
                        onChange={(e) => handleSimValueChange(n.id, parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                  </div>
              ))}
              <div className="bg-slate-800 text-white p-3 rounded-lg text-xs shadow-lg">
                  <div className="flex items-center gap-2 mb-1 font-bold text-emerald-400"><Sparkles size={12}/> Live Inference</div>
                  Adjust interventions to see causal propagation.
              </div>
          </div>
      )}

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-1 flex flex-col gap-1">
          <button onClick={() => handleZoom(1.2)} className="p-2 hover:bg-slate-100 rounded text-slate-600" title="Zoom In"><ZoomIn size={18} /></button>
          <button onClick={() => handleZoom(0.8)} className="p-2 hover:bg-slate-100 rounded text-slate-600" title="Zoom Out"><ZoomOut size={18} /></button>
          <button onClick={handleCenter} className="p-2 hover:bg-slate-100 rounded text-slate-600" title="Reset View"><Maximize size={18} /></button>
        </div>
      </div>

      {/* Node Inspector Panel */}
      {selectedNode && !simulationMode && (
        <div className="absolute bottom-6 right-6 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 animate-in slide-in-from-bottom-5 fade-in duration-200">
           <div className="flex justify-between items-start mb-4">
             <h3 className="font-semibold text-slate-800">Edit Node</h3>
             <button onClick={() => setSelectedNodeId(null)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
           </div>
           {/* Simple edit form for demo */}
           <div className="space-y-3">
             <div>
                <label className="text-xs text-slate-500 block">Label</label>
                <div className="text-sm font-medium text-slate-800">{selectedNode.label}</div>
             </div>
              <button 
                 onClick={() => onExpandNode(selectedNode.id)}
                 disabled={isExpanding}
                 className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors disabled:opacity-70"
               >
                 {isExpanding ? <div className="animate-spin w-3 h-3 border-2 border-white rounded-full border-t-transparent"></div> : <Sparkles size={14} />}
                 Expand with AI
               </button>
           </div>
        </div>
      )}
      
      {/* Simulation Inspector */}
      {selectedNode && simulationMode && (
         <div className="absolute bottom-6 right-6 w-64 bg-slate-900 text-white rounded-xl shadow-xl p-4 animate-in slide-in-from-bottom-5 fade-in duration-200">
           <div className="flex justify-between items-start mb-2">
             <h3 className="font-semibold">{selectedNode.label}</h3>
             <button onClick={() => setSelectedNodeId(null)} className="text-slate-400 hover:text-white"><X size={16}/></button>
           </div>
           <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-700 pb-2">
                  <span className="text-slate-400">Current Value</span>
                  <span className="font-mono text-emerald-400 text-lg">{(nodeValues[selectedNode.id] ?? 0.5).toFixed(3)}</span>
              </div>
              <div>
                  <span className="text-slate-400 block mb-1">Estimated Equation</span>
                  <code className="bg-slate-800 px-2 py-1 rounded block w-full text-center text-amber-300">
                      {selectedNode.equation || "f(inputs) ≈ Σ w_i * x_i"}
                  </code>
              </div>
           </div>
         </div>
      )}

    </div>
  );
};

export default CausalView;