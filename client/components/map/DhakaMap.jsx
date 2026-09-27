"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

const PADDING = 60;
const VIEW_SIZE = 680; // square canvas, matches the square 0-12 coordinate grid

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
      const px = PADDING + ((x - minX) / spanX) * (VIEW_SIZE - PADDING * 2);
      const py = PADDING + ((maxY - y) / spanY) * (VIEW_SIZE - PADDING * 2);
      return [px, py];
    }

    return { project };
  }, [nodes]);
}

// Renders text twice - a thick cream "halo" stroke behind, solid fill on
// top - so labels stay readable over crossing lines and colored paths.
function HaloText({ x, y, children, size = 13, weight = "600", fill = "var(--color-ink)" }) {
  return (
    <>
      <text
        x={x} y={y}
        fontSize={size}
        fontWeight={weight}
        stroke="var(--color-cream)"
        strokeWidth="4"
        strokeLinejoin="round"
        textAnchor="middle"
      >
        {children}
      </text>
      <text x={x} y={y} fontSize={size} fontWeight={weight} fill={fill} textAnchor="middle">
        {children}
      </text>
    </>
  );
}

export default function DhakaMap({ graph, paths = [], vehiclePosition, pickupCode, destinationCode }) {
  const { project } = useProjection(graph?.nodes || []);

  if (!graph || !graph.nodes.length) {
    return (
      <div className="w-full aspect-square flex items-center justify-center text-ink/40 border-2 border-dashed border-ink/10 rounded-2xl">
        Loading map...
      </div>
    );
  }

  const nodeByCode = Object.fromEntries(graph.nodes.map((n) => [n.code, n]));

  function isOnAnyPath(code) {
    return paths.some((p) => p.codes.includes(code));
  }

  function colorForNode(code) {
    const owning = paths.find((p) => p.codes.includes(code));
    return owning ? owning.color : null;
  }

  return (
    <div className="w-full bg-cream-dark/20 border-2 border-rickshaw-green/15 rounded-2xl p-3">
      <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} className="w-full h-auto">
        {graph.edges.map((e) => {
          const a = nodeByCode[e.from];
          const b = nodeByCode[e.to];
          if (!a || !b) return null;
          const [x1, y1] = project(a.x, a.y);
          const [x2, y2] = project(b.x, b.y);
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          return (
            <g key={`${e.from}-${e.to}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-ink)" strokeOpacity="0.18" strokeWidth="2.5" />
              <HaloText x={midX} y={midY - 6} size={12} weight="500" fill="var(--color-ink)">
                {e.weight}
              </HaloText>
            </g>
          );
        })}

        {paths.map((p, idx) => {
          const points = p.codes.map((c) => nodeByCode[c]).filter(Boolean).map((n) => project(n.x, n.y));
          if (points.length < 2) return null;
          const d = points.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt[0]} ${pt[1]}`).join(" ");
          return (
            <motion.path
              key={p.label || idx}
              d={d}
              fill="none"
              stroke={p.color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          );
        })}

        {graph.nodes.map((n) => {
          const [x, y] = project(n.x, n.y);
          const highlighted = isOnAnyPath(n.code);
          const isEndpoint = n.code === pickupCode || n.code === destinationCode;
          const color = colorForNode(n.code) || "var(--color-rickshaw-green)";

          return (
            <g key={n.code}>
              <circle
                cx={x} cy={y}
                r={isEndpoint ? 10 : highlighted ? 8 : 6}
                fill={isEndpoint ? color : "var(--color-cream)"}
                stroke={color}
                strokeWidth={highlighted || isEndpoint ? 3.5 : 2}
              />
              <HaloText x={x} y={y - 16} size={14} weight={highlighted ? "700" : "600"}>
                {n.name}
              </HaloText>
            </g>
          );
        })}

        {vehiclePosition && nodeByCode[vehiclePosition] && (
          <motion.g
            animate={{
              x: project(nodeByCode[vehiclePosition].x, nodeByCode[vehiclePosition].y)[0],
              y: project(nodeByCode[vehiclePosition].x, nodeByCode[vehiclePosition].y)[1],
            }}
            transition={{ type: "spring", stiffness: 80, damping: 14 }}
          >
            <circle r="13" fill="var(--color-marigold)" stroke="var(--color-ink)" strokeWidth="2.5" />
            <text y="5" fontSize="14" textAnchor="middle">🛺</text>
          </motion.g>
        )}
      </svg>
    </div>
  );
}