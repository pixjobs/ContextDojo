import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { MindMapNode, MindMapLink } from '../types';
import { LabelSet } from '../constants/translations';

interface MindMapProps {
  nodes: MindMapNode[];
  links: MindMapLink[];
  labels: LabelSet;
}

const COLORS = {
  root: '#ffffff',
  concept: '#38bdf8', // Light Blue
  entity: '#c084fc',  // Purple
  action: '#4ade80',  // Green
  emotion: '#fb7185', // Rose
  default: '#94a3b8'  // Slate
};

const MindMap: React.FC<MindMapProps> = ({ nodes, links, labels }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);

  // Keep track of simulation instance
  const simulationRef = useRef<d3.Simulation<d3.SimulationNodeDatum, undefined> | null>(null);
  
  // Cache positions to prevent "jumping" on updates
  const nodePositions = useRef<Map<string, {x: number, y: number, vx: number, vy: number}>>(new Map());

  // Helper to compute tree depth for vertical positioning
  const computeDepths = (nodeList: MindMapNode[], linkList: MindMapLink[]) => {
      const depths: Record<string, number> = {};
      const adj: Record<string, string[]> = {};
      
      // Build adjacency list safely, handling both string and object sources
      linkList.forEach(l => {
          const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
          const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
          if (!adj[s]) adj[s] = [];
          adj[s].push(t);
      });

      // BFS
      const queue: { id: string, d: number }[] = [{ id: 'Context', d: 0 }];
      depths['Context'] = 0;
      const visited = new Set(['Context']);

      while (queue.length > 0) {
          const { id, d } = queue.shift()!;
          if (adj[id]) {
              adj[id].forEach(childId => {
                  if (!visited.has(childId)) {
                      visited.add(childId);
                      depths[childId] = d + 1;
                      queue.push({ id: childId, d: d + 1 });
                  }
              });
          }
      }
      return depths;
  };

  // Helper to find path from a specific node back to root
  const getPathToRoot = (targetId: string, currentLinks: MindMapLink[]) => {
      const path = new Set<string>([targetId]);
      let currentId = targetId;
      let foundParent = true;
      let iterations = 0;
      
      while(foundParent && iterations < 100) {
          foundParent = false;
          // Find a link where target == currentId
          const parentLink = currentLinks.find(l => {
              const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
              return t === currentId;
          });

          if (parentLink) {
              const sourceId = typeof parentLink.source === 'object' ? (parentLink.source as any).id : parentLink.source;
              if (!path.has(sourceId)) {
                  path.add(sourceId);
                  currentId = sourceId;
                  foundParent = true;
              }
          }
          iterations++;
      }
      return path;
  };

  // Compute highlighting set
  const highlightSet = useMemo(() => {
      if (!selectedNode) return new Set<string>();
      return getPathToRoot(selectedNode.id, links);
  }, [selectedNode, links]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    if (nodes.length === 0) return;

    const width = containerRef.current.clientWidth || 800;
    // We don't limit height for simulation physics to avoid clamping bunch-up
    
    // --- 1. DATA PREPARATION ---
    // Deep clone to ensure D3 never mutates React props. 
    const simulationNodes = nodes.map(n => {
        const oldPos = nodePositions.current.get(n.id);
        return { 
            ...n, 
            // Preserve position if exists, else start centered top
            x: oldPos ? oldPos.x : width / 2, 
            y: oldPos ? oldPos.y : 50,
            vx: oldPos ? oldPos.vx : 0,
            vy: oldPos ? oldPos.vy : 0
        };
    }) as d3.SimulationNodeDatum[];

    // Ensure links are fresh objects with string IDs for D3 to resolve
    const simulationLinks = links.map(l => ({
        source: typeof l.source === 'object' ? (l.source as any).id : l.source,
        target: typeof l.target === 'object' ? (l.target as any).id : l.target
    }));

    // Clear previous SVG
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); 

    // Define Arrow Marker
    const defs = svg.append("defs");
    
    defs.append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 25) // Distance from node center
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#64748b");

    defs.append("marker")
        .attr("id", "arrowhead-active")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 25)
        .attr("refY", 0)
        .attr("markerWidth", 8)
        .attr("markerHeight", 8)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#38bdf8");

    // Compute Depths for Y-positioning
    const depths = computeDepths(nodes, links);

    // --- 2. SIMULATION SETUP ---
    const simulation = d3.forceSimulation(simulationNodes)
      .force("link", d3.forceLink(simulationLinks).id((d: any) => d.id).distance(80)) 
      .force("charge", d3.forceManyBody().strength(-500)) 
      .force("collide", d3.forceCollide().radius(40))
      // TOP-DOWN Tree Force
      .force("y", d3.forceY((d: any) => {
          const dDepth = depths[d.id] ?? 0;
          return 60 + (dDepth * 100); 
      }).strength(2)) 
      .force("x", d3.forceX(width / 2).strength(0.15));

    simulationRef.current = simulation;

    // --- 3. RENDERING ---
    const g = svg.append("g"); // Main group for zoom

    // Links
    const link = g.append("g")
      .selectAll("line")
      .data(simulationLinks)
      .join("line")
      .attr("stroke", (d: any) => {
          const s = d.source.id || d.source;
          const t = d.target.id || d.target;
          if (highlightSet.has(s) && highlightSet.has(t)) return "#38bdf8"; 
          return "#475569";
      })
      .attr("stroke-width", (d: any) => {
          const s = d.source.id || d.source;
          const t = d.target.id || d.target;
          if (highlightSet.has(s) && highlightSet.has(t)) return 3;
          return 1.5;
      })
      .attr("marker-end", (d: any) => {
           const s = d.source.id || d.source;
           const t = d.target.id || d.target;
           if (highlightSet.has(s) && highlightSet.has(t)) return "url(#arrowhead-active)";
           return "url(#arrowhead)";
      });

    // Node Groups
    const node = g.append("g")
      .selectAll("g")
      .data(simulationNodes)
      .join("g")
      .attr("class", "cursor-pointer")
      .attr("opacity", (d: any) => {
           if (selectedNode && !highlightSet.has(d.id)) return 0.3;
           return 1;
      })
      .on("click", (event, d: any) => {
          event.stopPropagation();
          const original = nodes.find(n => n.id === d.id);
          if (original) setSelectedNode(original);
      })
      .call(d3.drag<SVGGElement, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
      );

    // Node Circles
    node.append("circle")
      .attr("r", (d: any) => d.type === 'root' ? 18 : 12)
      .attr("fill", (d: any) => {
          if (highlightSet.has(d.id)) return (COLORS as any)[d.type];
          return d.status === 'potential' ? '#0f172a' : (COLORS as any)[d.type];
      })
      .attr("stroke", (d: any) => {
           if (highlightSet.has(d.id)) return "#e0f2fe"; 
           return (COLORS as any)[d.type];
      })
      .attr("stroke-width", (d: any) => {
          if (highlightSet.has(d.id)) return 3;
          return d.status === 'potential' ? 2 : 2;
      })
      .attr("stroke-dasharray", (d: any) => d.status === 'potential' ? "3 2" : "none");

    // Labels
    node.append("text")
      .text((d: any) => d.label)
      .attr("x", 18)
      .attr("y", 4)
      .attr("fill", (d: any) => {
          if (highlightSet.has(d.id)) return "#ffffff";
          return d.status === 'potential' ? "#94a3b8" : "#f1f5f9";
      })
      .attr("font-size", "11px")
      .attr("font-weight", (d: any) => d.status === 'active' || highlightSet.has(d.id) ? "700" : "500")
      .attr("font-family", "system-ui, sans-serif")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 3px rgba(0,0,0,0.8)");

    // Ticks
    simulation.on("tick", () => {
      // Clamping X only, let Y flow freely so tree doesn't smash
      const padding = 30;
      
      node.each((d: any) => {
          d.x = Math.max(padding, Math.min(width - padding, d.x));
          // d.y is NOT clamped to height to allow deep trees. 
          // We only clamp top to avoid flying off header.
          d.y = Math.max(padding, d.y);
          
          nodePositions.current.set(d.id, { x: d.x, y: d.y, vx: d.vx, vy: d.vy });
      });

      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
    // @ts-ignore
    svg.call(zoom);

    // Initial Zoom transform to center top if needed, or just identity
    // If the tree is huge, users can pan.
    
    // Drag functions
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [nodes, links, highlightSet]); 

  const handleBgClick = () => setSelectedNode(null);

  return (
    <div 
        ref={containerRef} 
        onClick={handleBgClick}
        className="w-full h-full min-h-[400px] overflow-hidden bg-slate-900 border-t border-slate-700 relative"
    >
      <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-none opacity-90 z-10">
          <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]"></span>
              <span className="text-[10px] text-slate-300 font-bold tracking-wide uppercase">{labels.legendDiscussed}</span>
          </div>
           <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-500 border-dashed bg-slate-900"></span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">{labels.legendRecommendation}</span>
          </div>
      </div>

      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing"></svg>

      {/* Insight Card Overlay */}
      {selectedNode && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 left-4 right-4 bg-slate-800/95 backdrop-blur-md border border-slate-600 rounded-xl p-4 shadow-2xl animate-fade-in z-20 flex flex-col gap-2"
          >
              <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: (COLORS as any)[selectedNode.type] || COLORS.default }}
                      ></div>
                      <h4 className="text-lg font-bold text-white leading-none">{selectedNode.label}</h4>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                      </svg>
                  </button>
              </div>
              
              <div className="flex gap-2 mb-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase ${
                      selectedNode.status === 'active' 
                      ? 'border-sky-500/50 text-sky-400 bg-sky-900/20' 
                      : 'border-slate-500/50 text-slate-400 bg-slate-800'
                  }`}>
                      {selectedNode.status === 'active' ? labels.activeTopic : labels.suggested}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 text-slate-400 uppercase">
                      {selectedNode.type}
                  </span>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                  {selectedNode.description || "No description available."}
              </p>
          </div>
      )}
    </div>
  );
};

export default MindMap;