"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

const PADDING = 72;
const VIEW_SIZE = 680;

export const PATH_COLORS = [
  "#C8283A", // rickshaw red
  "#4E9C90", // dusk teal
  "#7B4FA0", // plum
  "#2F6FB0", // steel blue
  "#EFA324", // marigold
];

function buildProjection(nodes) {
  if (!nodes.length) return () => [0, 0];
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  return (x, y) => [
    PADDING + ((x - minX) / spanX) * (VIEW_SIZE - PADDING * 2),
    PADDING + ((maxY - y) / spanY) * (VIEW_SIZE - PADDING * 2),
  ];
}

// Text drawn twice - a thick cream halo behind, solid ink on top - so labels
// stay readable over crossing lines and coloured paths.
function HaloText({ x, y, children, size = 13, weight = "600", fill = "var(--color-ink)" }) {
  return (
    <>
      <text
        x={x}
        y={y}
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

/**
 * graph: { nodes: [{code,name,x,y}], edges: [{from,to,weight}] }
 * paths: [{ codes, color, label }]   each passenger's own journey
 * spine: [codes]                     the vehicle's single combined route
 * vehiclePosition: zone code of the vehicle (null until the driver arrives)
 * pickupCode / destinationCode: emphasised endpoints (ride request page)
 */
export default function DhakaMap({
  graph,
  paths = [],
  spine = [],
  vehiclePosition,
  pickupCode,
  destinationCode,
}) {
  const reduceMotion = useReducedMotion();
  const nodes = graph?.nodes || [];

  const project = useMemo(() => buildProjection(nodes), [graph]); // eslint-disable-line react-hooks/exhaustive-deps
  const nodeByCode = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.code, n])),
    [graph] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const spinePoints = spine
    .map((code) => nodeByCode[code])
    .filter(Boolean)
    .map((n) => project(n.x, n.y));
  const spineD = spinePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");

  const vehicleIdx = vehiclePosition ? spine.indexOf(vehiclePosition) : -1;

  const prevIdxRef = useRef(vehicleIdx);
  const fromIdx = prevIdxRef.current;
  useEffect(() => {
    prevIdxRef.current = vehicleIdx;
  }, [vehicleIdx]);

  // Fraction of the drawn route already covered, measured along the actual line.
  let coveredFraction = 0;
  if (vehicleIdx > 0 && spinePoints.length > 1) {
    let total = 0;
    let covered = 0;
    for (let i = 1; i < spinePoints.length; i++) {
      const len = Math.hypot(
        spinePoints[i][0] - spinePoints[i - 1][0],
        spinePoints[i][1] - spinePoints[i - 1][1]
      );
      total += len;
      if (i <= vehicleIdx) covered += len;
    }
    coveredFraction = total ? covered / total : 0;
  }

  // The marker follows the road through every stop it passed, not a straight shortcut.
  let markerAnimate = null;
  let markerTransition = { duration: 0 };
  if (vehicleIdx >= 0 && spinePoints[vehicleIdx]) {
    if (fromIdx >= 0 && vehicleIdx > fromIdx && spinePoints[fromIdx]) {
      const seg = spinePoints.slice(fromIdx, vehicleIdx + 1);
      markerAnimate = { x: seg.map((p) => p[0]), y: seg.map((p) => p[1]) };
      markerTransition = reduceMotion
        ? { duration: 0 }
        : { duration: Math.max(0.7, 0.7 * (vehicleIdx - fromIdx)), ease: "easeInOut" };
    } else {
      markerAnimate = { x: spinePoints[vehicleIdx][0], y: spinePoints[vehicleIdx][1] };
      markerTransition = reduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" };
    }
  }

  if (!graph || !nodes.length) {
    return (
      <div className="w-full aspect-square flex items-center justify-center text-ink/40 border-2 border-dashed border-ink/10 rounded-2xl">
        Loading map...
      </div>
    );
  }

  function colorForNode(code) {
    const owning = paths.find((p) => p.codes.includes(code));
    return owning ? owning.color : null;
  }

  return (
    <div className="w-full bg-cream-dark/20 border-2 border-rickshaw-green/15 rounded-2xl p-3">
      <svg viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} className="w-full h-auto">
        {/* base road network */}
        {graph.edges.map((e) => {
          const a = nodeByCode[e.from];
          const b = nodeByCode[e.to];
          if (!a || !b) return null;
          const [x1, y1] = project(a.x, a.y);
          const [x2, y2] = project(b.x, b.y);
          return (
            <g key={`${e.from}-${e.to}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-ink)" strokeOpacity="0.18" strokeWidth="2.5" />
              <HaloText x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} size={12} weight="500">
                {e.weight}
              </HaloText>
            </g>
          );
        })}

        {/* the vehicle's route: dotted = still ahead, solid green = covered */}
        {spinePoints.length > 1 && (
          <>
            <path
              d={spineD}
              fill="none"
              stroke="var(--color-ink)"
              strokeOpacity="0.28"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="1 15"
            />
            <motion.path
              d={spineD}
              fill="none"
              stroke="var(--color-rickshaw-green)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: coveredFraction, opacity: coveredFraction > 0 ? 0.55 : 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.9, ease: "easeInOut" }}
            />
          </>
        )}

        {/* each passenger's own journey on top */}
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
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />
          );
        })}

        {/* nodes + names */}
        {graph.nodes.map((n) => {
          const [x, y] = project(n.x, n.y);
          const spineIdx = spine.indexOf(n.code);
          const visited = vehicleIdx >= 0 && spineIdx !== -1 && spineIdx <= vehicleIdx;
          const highlighted = paths.some((p) => p.codes.includes(n.code)) || spineIdx !== -1;
          const isEndpoint = n.code === pickupCode || n.code === destinationCode;
          const color = colorForNode(n.code) || "var(--color-rickshaw-green)";

          return (
            <g key={n.code}>
              <circle
                cx={x}
                cy={y}
                r={isEndpoint ? 10 : highlighted ? 8 : 6}
                fill={isEndpoint ? color : visited ? "var(--color-rickshaw-green)" : "var(--color-cream)"}
                stroke={color}
                strokeWidth={highlighted || isEndpoint ? 3.5 : 2}
              />
              <HaloText x={x} y={y - 16} size={14} weight={highlighted ? "700" : "600"}>
                {n.name}
              </HaloText>
            </g>
          );
        })}

        {/* pickup (circle) and drop-off (square) markers, one per passenger */}
        {paths.map((p, idx) => {
          if (p.codes.length < 2) return null;
          const startNode = nodeByCode[p.codes[0]];
          const endNode = nodeByCode[p.codes[p.codes.length - 1]];
          if (!startNode || !endNode) return null;
          const offset = (idx - (paths.length - 1) / 2) * 13;
          const [sx, sy] = project(startNode.x, startNode.y);
          const [ex, ey] = project(endNode.x, endNode.y);
          return (
            <g key={`ends-${p.label || idx}`}>
              <circle cx={sx + offset} cy={sy + 22} r="5" fill={p.color} stroke="var(--color-cream)" strokeWidth="1.5" />
              <rect x={ex + offset - 5} y={ey + 17} width="10" height="10" rx="2" fill={p.color} stroke="var(--color-cream)" strokeWidth="1.5" />
            </g>
          );
        })}

        {/* the vehicle */}
        {markerAnimate && (
          <motion.g
            initial={{ x: spinePoints[vehicleIdx][0], y: spinePoints[vehicleIdx][1] }}
            animate={markerAnimate}
            transition={markerTransition}
          >
            <circle r="14" fill="var(--color-marigold)" stroke="var(--color-ink)" strokeWidth="2.5" />
            <text y="5" fontSize="15" textAnchor="middle">🛺</text>
          </motion.g>
        )}
      </svg>

      <p className="text-xs text-ink/50 text-center mt-2">
        ● pickup &nbsp; ■ drop-off &nbsp;·&nbsp; dotted = road ahead, solid green = road covered
      </p>
    </div>
  );
}