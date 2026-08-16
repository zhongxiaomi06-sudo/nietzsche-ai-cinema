"use client";
import { useState } from "react";
import type { Dim } from "@/lib/world";
import { DCOLOR, BRANCHES } from "@/lib/world";
import { clamp, type Frame, scholarsFor, type GambitAction } from "@/lib/sim";
import type { World } from "@/lib/world";
import { Radar, Traj } from "./Viz";
import { RelationGraph } from "./RelationGraph";
import { GambitPanel } from "./GambitPanel";
import { AgentCard } from "./AgentCard";
import { useI18n } from "@/lib/i18n";

export function SidePanel({
  open,
  world,
  dims,
  idx,
  ch,
  base,
  firstFork,
  onClose,
  onBranch,
  onApplyGambit,
}: {
  open: boolean;
  world: World;
  dims: Dim[];
  idx: number;
  ch: Frame[];
  base: Frame[];
  firstFork: number;
  onClose: () => void;
  onBranch: (k: number) => void;
  onApplyGambit: (text: string) => void;
}) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [graphMode, setGraphMode] = useState<"live" | "gambit">("live");
  const [interventions, setInterventions] = useState<Record<string, GambitAction>>({});
  const cur = ch[idx];
  if (!cur) return null;
  const curState = cur.state;
  const baseState = (base[idx] && base[idx].state) || curState;
  const branches = BRANCHES[idx] || [];
  const scholars = scholarsFor(world, idx);
  // In live mode a node tap opens its psyche card; in gambit mode it selects a target.
  const selectedAgent = graphMode === "live" && selectedId ? world.agents.find((a) => a.id === selectedId) || null : null;

  const setAction = (id: string, action: GambitAction | null) => {
    setInterventions((prev) => {
      const next = { ...prev };
      if (action) next[id] = action;
      else delete next[id];
      return next;
    });
  };

  // Whether this chapter already carries a fate rewrite (god edit present).
  const appliedHere = !!cur.god;

  return (
    <>
    <aside className={`side ${open ? "open" : ""}`} aria-hidden={!open}>
      <button className="side-close" onClick={onClose} title="收起">
        ✕
      </button>
      <div className="side-h">{t("panel.vector")}</div>
      <Radar dims={dims} state={curState} baseState={baseState} />
      <div className="rail-dims">
        {dims.map((d) => {
          const v = clamp(curState[d.k]);
          return (
            <div className="rd" key={d.k}>
              <span className="lab">{d.name}</span>
              <span className="bar">
                <i style={{ width: `${Math.max(4, v)}%`, background: DCOLOR[d.k] }} />
              </span>
              <span className="val">{v}</span>
            </div>
          );
        })}
      </div>

      <div className="side-h" style={{ marginTop: 14 }}>
        {t("panel.delta")}
      </div>
      <div className="delta-box">
        {dims.map((d) => {
          const v = Math.round((curState[d.k] || 0) - (baseState[d.k] || 0));
          const cls = v > 0 ? "up" : v < 0 ? "down" : "flat";
          const label = v === 0 ? "±0" : v > 0 ? `▲ +${v}` : `▼ ${v}`;
          return (
            <div className="dd" key={d.k}>
              <span>{d.name}</span>
              <span className={`dval ${cls}`}>{label}</span>
            </div>
          );
        })}
      </div>

      <div className="side-h" style={{ marginTop: 14 }}>
        {t("panel.traj")}
      </div>
      <Traj
        dims={dims}
        chStates={ch.map((c) => c.state)}
        baseStates={base.map((c) => c.state)}
        curIdx={idx}
        firstFork={firstFork}
      />
      <div className="traj-legend">
        <i>{t("leg.cur")}</i>
        <i>{t("leg.ghost")}</i>
        <i>{t("leg.fork")}</i>
      </div>

      <div className="side-h graph-head" style={{ marginTop: 16 }}>
        {t("panel.graph")}
        <div className="graph-toggle">
          <button className={graphMode === "live" ? "on" : ""} onClick={() => setGraphMode("live")}>
            {t("panel.mode.live")}
          </button>
          <button className={graphMode === "gambit" ? "on" : ""} onClick={() => setGraphMode("gambit")}>
            {t("panel.mode.gambit")}
          </button>
        </div>
      </div>

      {graphMode === "live" ? (
        <>
          <RelationGraph agents={cur.res.agents} relations={cur.res.relations} onSelect={setSelectedId} selectedId={selectedId} />
          <div style={{ fontFamily: "var(--sans)", fontSize: ".68rem", color: "var(--faint)", lineHeight: 1.6, marginTop: 4 }}>
            {t("panel.graphHint")}
          </div>
          <div className="graph-legend">
            {[
              { c: "#5fae7e", l: "盟友" },
              { c: "#d2648e", l: "爱" },
              { c: "#c0413a", l: "对抗" },
              { c: "#d08a4a", l: "对手" },
              { c: "#9b7bd0", l: "镜像" },
              { c: "#c9a24a", l: "亲族" },
            ].map((x) => (
              <span key={x.l}>
                <i style={{ background: x.c }} />
                {x.l}
              </span>
            ))}
          </div>
          {cur.res.couplingNote && (
            <div className="coupling-note">
              <b>{t("panel.coupling")}</b>
              {cur.res.couplingNote}
            </div>
          )}
        </>
      ) : (
        <GambitPanel
          world={world}
          agents={cur.res.agents}
          relations={cur.res.relations}
          interventions={interventions}
          selected={selectedId}
          onSelectAgent={setSelectedId}
          onSetAction={setAction}
          onClear={() => setInterventions({})}
          onApply={onApplyGambit}
          applied={appliedHere}
        />
      )}

      <div className="branches">
        {branches.map((b, k) => (
          <button className="branch-btn" key={k} onClick={() => onBranch(k)}>
            <b>⟳ 命运分支 {k + 1}</b>
            {b.l}
          </button>
        ))}
      </div>

      <div className="side-h" style={{ marginTop: 16 }}>
        {t("panel.scholar")}
      </div>
      {scholars.length ? (
        scholars.map((s, i) => (
          <div className="scholar" key={i}>
            <div className="st">{s.topic}</div>
            <div className="sf">{s.finding}</div>
            {s.sources && s.sources.length > 0 && <div className="ss">来源：{s.sources.join("；")}</div>}
          </div>
        ))
      ) : (
        <div className="scholar">
          <div className="sf" style={{ color: "var(--faint)" }}>
            {t("panel.noScholar")}
          </div>
        </div>
      )}
    </aside>
    {selectedAgent && <AgentCard agent={selectedAgent} onClose={() => setSelectedId(null)} />}
    </>
  );
}
