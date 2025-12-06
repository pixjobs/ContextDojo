import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MindMapNode, MindMapLink } from '../types';

interface MindMapProps {
  nodes: MindMapNode[];
  links: MindMapLink[];
}

const COLORS = {
  root: '#ffffff',
  concept: '#38bdf8', // Light Blue
  entity: '#c084fc',  // Purple
  action: '#4ade80',  // Green
  emotion: '#fb7185', // Rose
  default: '#94a3b8'  // Slate
};

const MindMap: React.FC<MindMapProps> = ({ nodes, links }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    if (nodes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); 

    // Calculate node degree (number of connections) for sizing
    const nodeDegree: Record<string, number> = {};
    links.forEach(l => {
        const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
        const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
        nodeDegree[s] = (nodeDegree[s] || 0) + 1;
        nodeDegree[t] = (nodeDegree[t] || 0) + 1;
    });

    const getNodeRadius = (d: any) => {
        if (d.type === 'root') return 14;
        const degree = nodeDegree[d.id] || 0;
        return 8 + Math.min(degree * 2, 16); 
    };

    const getNodeColor = (type: string) => {
        return (COLORS as any)[type] || COLORS.default;
    };

    // Simulation setup
    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance((d: any) => {
           // Push potential nodes further out
           const target = nodes.find(n => n.id === d.target.id || n.id === d.target);
           return target?.status === 'potential' ? 90 : 60;
      }))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => getNodeRadius(d) + 8).iterations(2));

    // Draw links
    const link = svg.append("g")
      .attr("stroke", "#475569") 
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d: any) => {
          const target = nodes.find(n => n.id === d.target.id || n.id === d.target);
          return target?.status === 'potential' ? 1 : 2;
      })
      .attr("stroke-opacity", (d: any) => {
          const target = nodes.find(n => n.id === d.target.id || n.id === d.target);
          return target?.status === 'potential' ? 0.3 : 0.6;
      })
      .attr("stroke-dasharray", (d: any) => {
          const target = nodes.find(n => n.id === d.target.id || n.id === d.target);
          return target?.status === 'potential' ? "4 4" : "none";
      });

    // Draw nodes group
    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(d3.drag<SVGGElement, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
      );

    // Node circles
    node.append("circle")
      .attr("r", (d: any) => getNodeRadius(d))
      .attr("fill", (d: any) => d.status === 'potential' ? 'transparent' : getNodeColor(d.type))
      .attr("stroke", (d: any) => getNodeColor(d.type))
      .attr("stroke-width", (d: any) => d.status === 'potential' ? 1.5 : 2)
      .attr("stroke-dasharray", (d: any) => d.status === 'potential' ? "3 2" : "none")
      .attr("class", (d: any) => d.status === 'potential' ? "cursor-pointer hover:stroke-white" : "")
      .style("filter", (d: any) => d.status === 'active' || d.type === 'root' ? "drop-shadow(0 0 6px rgba(56, 189, 248, 0.3))" : "none");

    // Add pulse for root
    node.filter((d: any) => d.type === 'root')
        .select("circle")
        .classed("animate-pulse", true);

    // Labels
    node.append("text")
      .text((d: any) => d.label)
      .attr("x", (d: any) => getNodeRadius(d) + 5)
      .attr("y", 4)
      .attr("fill", (d: any) => d.status === 'potential' ? "#94a3b8" : "#f1f5f9")
      .attr("font-size", (d: any) => d.status === 'potential' ? "10px" : "12px")
      .attr("font-family", "ui-sans-serif, system-ui, sans-serif")
      .attr("font-style", (d: any) => d.status === 'potential' ? "italic" : "normal")
      .attr("font-weight", (d: any) => d.status === 'active' ? "600" : "400")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 2px rgba(0,0,0,0.8)");

    // Simulation tick update
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("transform", (d: any) => {
             // Clamping 
             const r = 20;
             d.x = Math.max(r, Math.min(width - r, d.x));
             d.y = Math.max(r, Math.min(height - r, d.y));
            return `translate(${d.x},${d.y})`;
        });
    });

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

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            svg.selectAll("g").attr("transform", event.transform);
        });

    // @ts-ignore
    svg.call(zoom);

    return () => {
      simulation.stop();
    };
  }, [nodes, links]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[300px] overflow-hidden bg-slate-900 border-t border-slate-700 relative">
        {/* Legend */}
        <div className="absolute top-2 left-2 flex flex-col gap-2 pointer-events-none opacity-90 z-10">
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_5px_rgba(56,189,248,0.8)]"></span>
                <span className="text-[10px] text-slate-300 font-bold tracking-wide">ACTIVE TOPIC</span>
            </div>
             <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full border border-sky-400 border-dashed opacity-50"></span>
                <span className="text-[10px] text-slate-400 font-medium tracking-wide">SUGGESTED AVENUE</span>
            </div>
        </div>
        
        {nodes.length <= 1 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 pointer-events-none p-4 text-center">
                <p className="mb-2 text-lg font-light text-slate-400">Knowledge Galaxy</p>
                <p className="text-xs">Start chatting to map your conversation and discover new avenues.</p>
            </div>
        )}
      <svg ref={svgRef} className="w-full h-full cursor-move"></svg>
    </div>
  );
};

export default MindMap;