"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

const PADDING = 48;
const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 440;

// Assigns each highlighted path a distinct, high-contrast color so
// overlapping journeys stay visually distinguishable from each other
// and from the base graph.
export const PATH_COLORS = [
  "#C8283A", // rickshaw red
  "#4E9C90", // dusk teal
  "#7B4FA0", // plum
  "#2F6FB0", // steel blue
  "#EFA324", // marigold
];

function useProjection(nodes) {
  return useMemo(() => {
    if (!nodes.length) return { project: () => [0, 0] };

    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;

    function project(x, y) {
      const px = PADDING + ((x - minX) / spanX) * (VIEW_WIDTH - PADDING * 2);
      // Flip Y so a visually higher coordinate renders near the top.
      const py = PADDING + ((maxY - y) / spanY) * (VIEW_HEIGHT - PADDING * 2);
      return [px, py];
    }

    return { project };
  }, [nodes]);
}

/**
 * graph: { nodes: [{code,name,x,y}], edges: [{from,to,weight}] }
 * paths: [{ codes: [zoneCode,...], color, label }]  - highlighted routes
 * vehiclePosition: zone code where a Bullet marker should render
 * pickupCode / destinationCode: single-journey emphasis (request page)
 */
export default function DhakaMap({
  graph,
  paths = [],
  vehiclePosition,
  pickupCode,
  destinationCode,
}) {
  const { project } = useProjection(graph?.nodes || []);

  if (!graph || !graph.nodes.length) {
    return (
      <div className="w-full aspect-[16/11] flex items-center justify-center text-ink/40 border-2 border-dashed border-ink/10 rounded-2xl">
        Loading map...
      </div>
    );
  }

  const nodeByCode = Object.fromEntries(graph.nodes.map((n) => [n.code, n]));

  function isOnAnyPath(code) {
    return paths.some((p) => p.codes.includes(code));
  }

  function colorForNode(code) {
    const owningPath = paths.find((p) => p.codes.includes(code));
    return owningPath ? owningPath.color : null;
  }

  return (
    <div className="w-full bg-cream-dark/20 border-2 border-rickshaw-green/15 rounded-2xl p-2">
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="w-full h-auto">
        {/* base graph edges */}
        {graph.edges.map((e, i) => {
          const a = nodeByCode[e.from];
          const b = nodeByCode[e.to];
          if (!a || !b) return null;
          const [x1, y1] = project(a.x, a.y);
          const [x2, y2] = project(b.x, b.y);
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          return (
            <g key={`${e.from}-${e.to}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-ink)" strokeOpacity="0.12" strokeWidth="2" />
              <text x={midX} y={midY - 4} fontSize="9" fill="var(--color-ink)" opacity="0.35" textAnchor="middle">
                {e.weight}
              </text>
            </g>
          );
        })}

        {/* highlighted passenger/pool paths, drawn on top, animated in */}
        {paths.map((p, idx) => {
          const points = p.codes
            .map((code) => nodeByCode[code])
            .filter(Boolean)
            .map((n) => project(n.x, n.y));
          if (points.length < 2) return null;
          const d = points.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt[0]} ${pt[1]}`).join(" ");
          return (
            <motion.path
              key={p.label || idx}
              d={d}
              fill="none"
              stroke={p.color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          );
        })}

        {/* nodes */}
        {graph.nodes.map((n) => {
          const [x, y] = project(n.x, n.y);
          const highlighted = isOnAnyPath(n.code);
          const isPickup = n.code === pickupCode;
          const isDestination = n.code === destinationCode;
          const nodeColor = colorForNode(n.code) || "var(--color-rickshaw-green)";

          return (
            <g key={n.code}>
              <circle
                cx={x}
                cy={y}
                r={isPickup || isDestination ? 9 : highlighted ? 7 : 5}
                fill={isPickup || isDestination ? nodeColor : "var(--color-cream)"}
                stroke={nodeColor}
                strokeWidth={highlighted || isPickup || isDestination ? 3 : 2}
              />
              <text
                x={x}
                y={y - 14}
                fontSize="11"
                fontWeight={highlighted ? "700" : "500"}
                fill="var(--color-ink)"
                textAnchor="middle"
              >
                {n.name}
              </text>
            </g>
          );
        })}

        {/* vehicle marker */}
        {vehiclePosition && nodeByCode[vehiclePosition] && (
          <motion.g
            animate={{
              x: project(nodeByCode[vehiclePosition].x, nodeByCode[vehiclePosition].y)[0],
              y: project(nodeByCode[vehiclePosition].x, nodeByCode[vehiclePosition].y)[1],
            }}
            transition={{ type: "spring", stiffness: 80, damping: 14 }}
          >
            <circle r="12" fill="var(--color-marigold)" stroke="var(--color-ink)" strokeWidth="2" />
            <text y="4" fontSize="12" textAnchor="middle">🛺</text>
          </motion.g>
        )}
      </svg>
    </div>
  );
}