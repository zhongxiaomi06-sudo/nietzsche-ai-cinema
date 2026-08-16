"use client";
import { useMemo } from "react";
import type { AgentActivation, RelationEdge, GambitResult } from "@/lib/sim";
import { hseed } from "@/lib/sim";

// Relationship-type colors.
const REL_COLOR: Record<string, string> = {
  love: "#d2648e",
  ally: "#5fae7e",
  antagonist: "#c0413a",
  rival: "#d08a4a",
  mirror: "#9b7bd0",
  family: "#c9a24a",
  neutral: "#7d7360",
  context: "#7d92c4",
  absurd: "#8a7d63",
};

// Faction palette for gambit mode.
const FACTION_FILL: Record<string, string> = {
  inner: "#5fae7e",
  hostile: "#c0413a",
  drift: "#4a453e",
};

type Node = { id: string; name: string; initials: string; x: number; y: number; a: number; onStage: boolean };

// Deterministic radial layout — Nietzsche pinned center, others on a stable ring.
export function RelationGraph({
  agents,
  relations,
  onSelect,
  gambit,
  selectedId,
}: {
  agents: AgentActivation[];
  relations: RelationEdge[];
  onSelect?: (id: string) => void;
  gambit?: GambitResult | null;
  selectedId?: string | null;
}) {
  const W = 300,
    H = 300,
    cx = 150,
    cy = 150;

  const nodes = useMemo<Record<string, Node>>(() => {
    const others = agents.filter((a) => a.id !== "nietzsche");
    const n = others.length || 1;
    const map: Record<string, Node> = {};
    const nz = agents.find((a) => a.id === "nietzsche");
    map["nietzsche"] = { id: "nietzsche", name: nz?.name || "尼采", initials: nz?.initials || "尼", x: cx, y: cy, a: 1, onStage: true };
    others
      .slice()
      .sort((a, b) => hseed(a.id) - hseed(b.id))
      .forEach((ag, i) => {
        const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
        const ring = 78 + (hseed(ag.id) % 2) * 34; // 78 or 112
        map[ag.id] = {
          id: ag.id,
          name: ag.name,
          initials: ag.initials,
          x: cx + ring * Math.cos(ang),
          y: cy + ring * Math.sin(ang),
          a: ag.activation,
          onStage: ag.onStage,
        };
      });
    return map;
  }, [agents]);

  const inGambit = !!gambit;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      {/* edges */}
      {inGambit
        ? gambit!.edges.map((e, i) => {
            const a = nodes[e.from];
            const b = nodes[e.to];
            if (!a || !b) return null;
            const col = e.onShockPath ? "#e3c172" : REL_COLOR[e.type] || "#7d7360";
            const op = e.onShockPath ? 0.35 + e.heat * 0.6 : 0.08 + Math.abs(e.effWeight) * 0.22;
            const w = e.onShockPath ? 1 + e.heat * 3 : 0.4 + Math.abs(e.effWeight) * 1.4;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={col}
                strokeWidth={w}
                opacity={op}
                strokeLinecap="round"
                strokeDasharray={e.delta < -0.05 ? "3 3" : undefined}
                style={{ transition: "opacity .5s, stroke-width .5s, stroke .5s" }}
              />
            );
          })
        : relations.map((e, i) => {
            const a = nodes[e.from];
            const b = nodes[e.to];
            if (!a || !b) return null;
            const col = REL_COLOR[e.type] || "#7d7360";
            const op = 0.12 + e.intensity * 0.7;
            const w = 0.5 + e.intensity * 2.2;
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={col} strokeWidth={w} opacity={op} strokeLinecap="round" style={{ transition: "opacity .5s, stroke-width .5s" }} />;
          })}

      {/* nodes */}
      {Object.values(nodes).map((nd) => {
        const isNz = nd.id === "nietzsche";
        const g = inGambit ? gambit!.nodes[nd.id] : null;
        const heat = g ? g.heat : nd.a;
        const r = isNz ? 16 : 8 + heat * 8;
        let fill: string;
        if (inGambit && g) {
          fill = isNz ? "#c9a24a" : FACTION_FILL[g.faction];
        } else {
          fill = isNz ? "#c9a24a" : nd.onStage ? "#e3c172" : "#3a3530";
        }
        const glow = 0.15 + heat * 0.85;
        const isSelected = selectedId === nd.id;
        const intervened = !!(g && g.intervened);
        return (
          <g
            key={nd.id}
            style={{ transition: "opacity .5s", cursor: onSelect ? "pointer" : "default" }}
            opacity={isNz ? 1 : inGambit ? 0.45 + heat * 0.55 : 0.35 + nd.a * 0.65}
            onClick={() => onSelect?.(nd.id)}
          >
            {/* larger invisible hit area for easy tapping */}
            <circle cx={nd.x} cy={nd.y} r={r + 8} fill="transparent" />
            {/* selection ring */}
            {isSelected && !isNz && (
              <circle cx={nd.x} cy={nd.y} r={r + 6} fill="none" stroke="#fff7e6" strokeWidth={1.4} opacity={0.9} />
            )}
            {/* intervened marker ring */}
            {intervened && !isNz && (
              <circle cx={nd.x} cy={nd.y} r={r + 4} fill="none" stroke="#e3c172" strokeWidth={1.6} strokeDasharray="2 2" opacity={0.95}>
                <animateTransform attributeName="transform" type="rotate" from={`0 ${nd.x} ${nd.y}`} to={`360 ${nd.x} ${nd.y}`} dur="6s" repeatCount="indefinite" />
              </circle>
            )}
            {heat > 0.5 && !isNz && <circle cx={nd.x} cy={nd.y} r={r + 5} fill={fill} opacity={glow * 0.25} />}
            <circle cx={nd.x} cy={nd.y} r={r} fill={fill} stroke={isNz ? "#fff7e6" : "rgba(255,255,255,.25)"} strokeWidth={isNz ? 1.6 : 1} style={{ transition: "r .5s, fill .5s" }} />
            <text x={nd.x} y={nd.y} fontSize={isNz ? 12 : 9} fill={isNz || nd.onStage || (g && g.heat > 0.3) ? "#0c0a08" : "#a99c80"} textAnchor="middle" dominantBaseline="central" fontWeight={700} style={{ fontFamily: "var(--serif)", pointerEvents: "none" }}>
              {nd.initials}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
