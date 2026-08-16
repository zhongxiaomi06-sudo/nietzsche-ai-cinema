"use client";
import { useMemo } from "react";
import type { World } from "@/lib/world";
import type { AgentActivation, RelationEdge, GambitAction, GambitResult } from "@/lib/sim";
import { gambitPropagate, gambitToGod, GAMBIT_ACTIONS } from "@/lib/sim";
import { RelationGraph } from "./RelationGraph";
import { useI18n } from "@/lib/i18n";

const ACTION_META: Record<GambitAction, { icon: string; cls: string }> = {
  draw: { icon: "⇢", cls: "g-draw" },
  rupture: { icon: "⚡", cls: "g-rupture" },
  ally: { icon: "⛨", cls: "g-ally" },
};

// Multi-agent gambit surface: intervene on any figure, watch the shock cascade
// across the signed relation network and the factions regroup.
export function GambitPanel({
  world,
  agents,
  relations,
  interventions,
  selected,
  onSelectAgent,
  onSetAction,
  onClear,
  onApply,
  applied,
}: {
  world: World;
  agents: AgentActivation[];
  relations: RelationEdge[];
  interventions: Record<string, GambitAction>;
  selected: string | null;
  onSelectAgent: (id: string | null) => void;
  onSetAction: (id: string, action: GambitAction | null) => void;
  onClear: () => void;
  onApply: (text: string) => void;
  applied: boolean;
}) {
  const { t } = useI18n();
  const gambit: GambitResult = useMemo(() => gambitPropagate(world, interventions), [world, interventions]);
  const godText = useMemo(() => gambitToGod(world, interventions), [world, interventions]);

  const nameOf = (id: string) => world.agents.find((a) => a.id === id)?.name || id;
  const sel = selected && selected !== "nietzsche" ? gambit.nodes[selected] : null;
  const activeList = Object.keys(interventions);

  return (
    <div className="gambit">
      <RelationGraph agents={agents} relations={relations} gambit={gambit} onSelect={onSelectAgent} selectedId={selected} />

      {/* faction tally */}
      <div className="g-factions">
        <span className="gf inner">
          <i />
          {t("gambit.inner")} {gambit.factions.inner.length - 1}
        </span>
        <span className="gf hostile">
          <i />
          {t("gambit.hostile")} {gambit.factions.hostile.length}
        </span>
        <span className="gf drift">
          <i />
          {t("gambit.drift")} {gambit.factions.drift.length}
        </span>
      </div>

      {/* action chooser for the selected figure */}
      {sel ? (
        <div className="g-chooser">
          <div className="g-sel-head">
            <b>{sel.name}</b>
            <span className="g-sel-meta">
              {t("gambit.heat")} {Math.round(sel.heat * 100)} · {t("gambit.stance")}{" "}
              {sel.valence > 0 ? "+" : ""}
              {Math.round(sel.valence * 100)}
            </span>
          </div>
          <div className="g-actions">
            {GAMBIT_ACTIONS.map((act) => {
              const on = interventions[selected!] === act;
              return (
                <button
                  key={act}
                  className={`g-act ${ACTION_META[act].cls} ${on ? "on" : ""}`}
                  onClick={() => onSetAction(selected!, on ? null : act)}
                >
                  <span className="gi">{ACTION_META[act].icon}</span>
                  {t(`gambit.act.${act}`)}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="g-hint">{t("gambit.pick")}</div>
      )}

      {/* stacked interventions */}
      {activeList.length > 0 && (
        <div className="g-stack">
          <div className="g-stack-h">
            <span>{t("gambit.active", { n: activeList.length })}</span>
            <button className="g-clear" onClick={onClear}>
              {t("gambit.reset")}
            </button>
          </div>
          {activeList.map((id) => (
            <div className="g-chip" key={id}>
              <span className={`gi ${ACTION_META[interventions[id]].cls}`}>{ACTION_META[interventions[id]].icon}</span>
              <b>{nameOf(id)}</b>
              <span className="g-chip-act">{t(`gambit.act.${interventions[id]}`)}</span>
              <button className="g-chip-x" onClick={() => onSetAction(id, null)} aria-label="remove">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* cascade summary */}
      <div className="g-summary">{gambit.summary}</div>

      {/* apply the whole gambit back into the main timeline as a fate rewrite */}
      {activeList.length > 0 && (
        <div className="g-apply">
          <div className="g-apply-preview">
            <span className="g-apply-tag">{t("gambit.applyPreview")}</span>
            {godText}
          </div>
          <button className={`g-apply-btn ${applied ? "done" : ""}`} onClick={() => onApply(godText)}>
            {applied ? t("gambit.applied") : t("gambit.apply")}
          </button>
          <div className="g-apply-hint">{t("gambit.applyHint")}</div>
        </div>
      )}
    </div>
  );
}
