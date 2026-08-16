"use client";
import { DCOLOR, type Dim, type State } from "@/lib/world";
import { clamp } from "@/lib/sim";

// Radar chart (SVG) — current life vector vs the original ghost polygon.
export function Radar({ dims, state, baseState }: { dims: Dim[]; state: State; baseState: State }) {
  const S = 200,
    cx = 100,
    cy = 98,
    R = 64,
    n = dims.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const grids: string[] = [];
  for (let g = 1; g <= 4; g++) {
    const rr = (R * g) / 4;
    const pts = dims.map((_, i) => `${cx + rr * Math.cos(ang(i))},${cy + rr * Math.sin(ang(i))}`);
    grids.push(pts.join(" "));
  }
  const gpts = dims.map((d, i) => {
    const v = clamp(baseState[d.k]) / 100;
    return `${(cx + R * v * Math.cos(ang(i))).toFixed(1)},${(cy + R * v * Math.sin(ang(i))).toFixed(1)}`;
  });
  const poly = dims
    .map((d, i) => {
      const v = clamp(state[d.k]) / 100;
      return `${(cx + R * v * Math.cos(ang(i))).toFixed(1)},${(cy + R * v * Math.sin(ang(i))).toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${S} ${S}`} width="100%">
      <polygon points={gpts.join(" ")} fill="rgba(169,156,128,.08)" stroke="rgba(169,156,128,.6)" strokeWidth={1} strokeDasharray="3 3" />
      <polygon points={poly} fill="rgba(201,162,74,.2)" stroke="#c9a24a" strokeWidth={1.8} />
      {grids.map((p, i) => (
        <polygon key={i} points={p} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={1} />
      ))}
      {dims.map((d, i) => {
        const x = cx + R * Math.cos(ang(i)),
          y = cy + R * Math.sin(ang(i));
        const lx = cx + (R + 12) * Math.cos(ang(i)),
          ly = cy + (R + 12) * Math.sin(ang(i));
        const v = clamp(state[d.k]) / 100;
        const dx = cx + R * v * Math.cos(ang(i)),
          dy = cy + R * v * Math.sin(ang(i));
        return (
          <g key={d.k}>
            <line x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke="rgba(255,255,255,.1)" strokeWidth={1} />
            <circle cx={dx.toFixed(1)} cy={dy.toFixed(1)} r={2.2} fill={DCOLOR[d.k]} />
            <text x={lx.toFixed(1)} y={ly.toFixed(1)} fontSize={8} fill="#a99c80" textAnchor="middle" dominantBaseline="middle">
              {d.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Fate trajectory — all dims across chapters, with original ghost + fork band.
export function Traj({
  dims,
  chStates,
  baseStates,
  curIdx,
  firstFork,
}: {
  dims: Dim[];
  chStates: State[];
  baseStates: State[];
  curIdx: number;
  firstFork: number;
}) {
  const TW = 300,
    TH = 110,
    pl = 6,
    pr = 6,
    pt = 8,
    pb = 10,
    n = chStates.length;
  if (!n) return null;
  const X = (i: number) => pl + (TW - pl - pr) * (i / (n - 1));
  const Y = (v: number) => pt + (TH - pt - pb) * (1 - (v || 0) / 100);
  return (
    <svg viewBox={`0 0 ${TW} ${TH}`} preserveAspectRatio="none" width="100%" style={{ height: 110 }}>
      {baseStates.length > 0 &&
        dims.map((d) => (
          <polyline
            key={"g" + d.k}
            points={baseStates.map((c, i) => `${X(i).toFixed(1)},${Y(c[d.k] || 0).toFixed(1)}`).join(" ")}
            fill="none"
            stroke="rgba(169,156,128,.5)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.6}
          />
        ))}
      {firstFork >= 0 && (
        <g>
          <rect x={X(firstFork).toFixed(1)} y={pt} width={(X(n - 1) - X(firstFork)).toFixed(1)} height={TH - pt - pb} fill="rgba(192,65,58,.22)" />
          <line x1={X(firstFork).toFixed(1)} y1={pt} x2={X(firstFork).toFixed(1)} y2={TH - pb} stroke="#c0413a" strokeWidth={2} />
          <text x={(X(firstFork) + 3).toFixed(1)} y={pt + 8} fontSize={8} fill="#e88a84" fontWeight={700}>
            ⚡
          </text>
        </g>
      )}
      <line x1={X(curIdx)} y1={pt} x2={X(curIdx)} y2={TH - pb} stroke="#c9a24a" strokeWidth={1.3} strokeDasharray="3 3" />
      {dims.map((d) => (
        <polyline
          key={d.k}
          points={chStates.map((c, i) => `${X(i).toFixed(1)},${Y(c[d.k] || 0).toFixed(1)}`).join(" ")}
          fill="none"
          stroke={DCOLOR[d.k]}
          strokeWidth={1.3}
          opacity={0.85}
        />
      ))}
    </svg>
  );
}
