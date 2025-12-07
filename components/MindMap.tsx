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
      
      // Build adjacency list
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
      let maxDepth = 0;

      while (queue.length > 0) {
          const { id, d } = queue.shift()!;
          maxDepth = Math.max(maxDepth, d);
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
      return { depths, maxDepth };
  };

  // Helper to find path from a specific node back to root
  const getPathToRoot = (targetId: string, currentLinks: MindMapLink[]) => {
      const path = new Set<string>([targetId]);
      let currentId = targetId;
      let foundParent = true;
      let iterations = 0;
      
      while(foundParent && iterations < 100) {
          foundParent = false;
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

    const containerWidth = containerRef.current.clientWidth || 800;
    
    // --- 1. COMPUTE DEPTHS FOR LAYOUT ---
    const { depths, maxDepth } = computeDepths(nodes, links);
    
    // Calculate Dynamic Height based on tree depth
    const Y_SPACING = 120; // Vertical space between tiers
    const MIN_HEIGHT = 400;
    const PADDING_TOP = 60;
    const PADDING_BOTTOM = 60;
    
    const requiredHeight = Math.max(MIN_HEIGHT, (maxDepth * Y_SPACING) + PADDING_TOP + PADDING_BOTTOM);

    // Resize SVG container dynamically
    const svg = d3.select(svgRef.current);
    svg.attr("height", requiredHeight);

    // --- 2. DATA PREPARATION ---
    const simulationNodes = nodes.map(n => {
        const oldPos = nodePositions.current.get(n.id);
        const depth = depths[n.id] ?? 0;
        return { 
            ...n, 
            // Start near their target depth so they don't fly across screen
            x: oldPos ? oldPos.x : containerWidth / 2, 
            y: oldPos ? oldPos.y : (depth * Y_SPACING) + PADDING_TOP,
            vx: oldPos ? oldPos.vx : 0,
            vy: oldPos ? oldPos.vy : 0
        };
    }) as d3.SimulationNodeDatum[];

    const simulationLinks = links.map(l => ({
        source: typeof l.source === 'object' ? (l.source as any).id : l.source,
        target: typeof l.target === 'object' ? (l.target as any).id : l.target
    }));

    svg.selectAll("*").remove(); 

    // --- 3. DEFINITIONS ---
    const defs = svg.append("defs");
    // Standard arrow
    defs.append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 18) // Distance adapted for Rect
        .attr("refY", 0)
        .attr("markerWidth", 5)
        .attr("markerHeight", 5)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#64748b");

    // Active Arrow
    defs.append("marker")
        .attr("id", "arrowhead-active")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 18) 
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#38bdf8");

    // --- 4. SIMULATION ---
    const simulation = d3.forceSimulation(simulationNodes)
      .force("link", d3.forceLink(simulationLinks).id((d: any) => d.id).distance(100)) 
      .force("charge", d3.forceManyBody().strength(-300)) 
      .force("collide", d3.forceCollide().radius(60).iterations(2))
      // STRICT Y-FORCE for Chronology/Tree structure
      .force("y", d3.forceY((d: any) => {
          const dDepth = depths[d.id] ?? 0;
          return (dDepth * Y_SPACING) + PADDING_TOP; 
      }).strength(2.5)) 
      // Gentle X-Force to center
      .force("x", d3.forceX(containerWidth / 2).strength(0.08));

    simulationRef.current = simulation;

    // --- 5. RENDER ELEMENTS ---
    const g = svg.append("g"); 

    // Links (Curves)
    const link = g.append("g")
      .selectAll("path")
      .data(simulationLinks)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", (d: any) => {
          const s = d.source.id || d.source;
          const t = d.target.id || d.target;
          if (highlightSet.has(s) && highlightSet.has(t)) return "#38bdf8"; 
          return "#334155";
      })
      .attr("stroke-width", (d: any) => {
          const s = d.source.id || d.source;
          const t = d.target.id || d.target;
          if (highlightSet.has(s) && highlightSet.has(t)) return 2;
          return 1;
      });

    // Nodes (Groups)
    const node = g.append("g")
      .selectAll("g")
      .data(simulationNodes)
      .join("g")
      .attr("class", "cursor-pointer transition-opacity duration-300")
      .attr("opacity", (d: any) => {
           if (selectedNode && !highlightSet.has(d.id)) return 0.2;
           return 1;
      })
      .on("click", (event, d: any) => {
          event.stopPropagation();
          const original = nodes.find(n => n.id === d.id);
          if (original) setSelectedNode(original);
      });
      // Removing drag behavior to maintain strict chronological Y-positions

    // --- CAPSULE SHAPE ---
    // We render Text first to measure it, OR just approximate with padding
    // Let's use fixed height rects with padding based on text length estimation
    
    node.each(function(d: any) {
        const el = d3.select(this);
        const charCount = d.label.length;
        const rectWidth = Math.max(100, charCount * 7 + 24); // Dynamic width
        const rectHeight = 36;
        
        // Save width for tick updates
        d.width = rectWidth;
        d.height = rectHeight;

        el.append("rect")
            .attr("rx", 18) // Pill shape
            .attr("ry", 18)
            .attr("x", -rectWidth / 2)
            .attr("y", -rectHeight / 2)
            .attr("width", rectWidth)
            .attr("height", rectHeight)
            .attr("fill", (d: any) => {
                if (highlightSet.has(d.id)) return (COLORS as any)[d.type] + '40'; // Transparent bg when active
                return "#1e293b"; // Dark slate
            })
            .attr("stroke", (d: any) => {
                if (highlightSet.has(d.id)) return "#e0f2fe"; 
                return (COLORS as any)[d.type] || COLORS.default;
            })
            .attr("stroke-width", (d: any) => {
                if (highlightSet.has(d.id)) return 2;
                return d.status === 'potential' ? 1 : 2;
            })
            .attr("stroke-dasharray", (d: any) => d.status === 'potential' ? "4 2" : "none");

        el.append("text")
            .text(d.label)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .attr("fill", (d: any) => {
                if (highlightSet.has(d.id)) return "#ffffff";
                return d.status === 'potential' ? "#94a3b8" : "#f1f5f9";
            })
            .attr("font-size", "12px")
            .attr("font-weight", (d: any) => d.status === 'active' || highlightSet.has(d.id) ? "600" : "400")
            .style("pointer-events", "none");
    });

    // Simulation Tick
    simulation.on("tick", () => {
      const padding = 20;
      
      node.each((d: any) => {
          // Clamp X to stay in container
          const w = d.width || 100;
          d.x = Math.max(w/2 + padding, Math.min(containerWidth - w/2 - padding, d.x));
          
          // d.y is constrained by ForceY primarily, but we update cache
          nodePositions.current.set(d.id, { x: d.x, y: d.y, vx: d.vx, vy: d.vy });
      });

      // Update Curved Links (Bezier for tree-like feel)
      link.attr("d", (d: any) => {
        const sourceX = d.source.x;
        const sourceY = d.source.y + (d.source.height / 2); // Start from bottom of pill
        const targetX = d.target.x;
        const targetY = d.target.y - (d.target.height / 2); // End at top of pill
        
        // Cubic Bezier for smooth vertical flow
        return `M${sourceX},${sourceY} 
                C${sourceX},${(sourceY + targetY) / 2} 
                 ${targetX},${(sourceY + targetY) / 2} 
                 ${targetX},${targetY}`;
      });

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
      
      // Auto-scroll to bottom on first load or significant change
      if (containerRef.current && nodes.length > 1) {
          // Only scroll if user isn't actively scrolling up? 
          // For now, let's just gently ensure bottom is visible if it's new
          // containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links, highlightSet]); 

  const handleBgClick = () => setSelectedNode(null);

  return (
    <div 
        ref={containerRef} 
        onClick={handleBgClick}
        className="w-full h-full min-h-[400px] overflow-y-auto overflow-x-hidden bg-slate-900 border-t border-slate-700 relative scrollbar-thin scrollbar-thumb-slate-700"
    >
      <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-none opacity-90 z-10 sticky">
          <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]"></span>
              <span className="text-[10px] text-slate-300 font-bold tracking-wide uppercase">{labels.legendDiscussed}</span>
          </div>
           <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-500 border-dashed bg-slate-900"></span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">{labels.legendRecommendation}</span>
          </div>
      </div>

      <svg ref={svgRef} className="w-full block min-h-full"></svg>

      {/* Insight Card Overlay (Sticky at bottom) */}
      {selectedNode && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className="sticky bottom-4 left-4 right-4 mx-4 bg-slate-800/95 backdrop-blur-md border border-slate-600 rounded-xl p-4 shadow-2xl animate-fade-in z-20 flex flex-col gap-2 mb-4"
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