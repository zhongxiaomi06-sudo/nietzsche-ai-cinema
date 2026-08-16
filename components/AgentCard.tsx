"use client";
import { useEffect, useState } from "react";
import type { Agent } from "@/lib/world";
import { useI18n } from "@/lib/i18n";

// Inner-world card for a relation-graph agent — surfaces the deep psyche data,
// plus a "let them speak" CTA that voices one AI line in-character.
export function AgentCard({ agent, onClose }: { agent: Agent | null; onClose: () => void }) {
  const { t } = useI18n();
  const [voiceState, setVoiceState] = useState<"idle" | "loading" | "done" | "fail">("idle");
  const [line, setLine] = useState("");

  // reset when the selected agent changes
  useEffect(() => {
    setVoiceState("idle");
    setLine("");
  }, [agent?.id]);

  if (!agent) return null;
  const p = agent.psyche || {};
  const rows: { k: string; label: string; v?: string }[] = [
    { k: "archetype", label: t("psy.archetype"), v: p.archetype },
    { k: "desire", label: t("psy.desire"), v: p.desire },
    { k: "fear", label: t("psy.fear"), v: p.fear },
    { k: "contradiction", label: t("psy.contradiction"), v: p.contradiction },
    { k: "mask", label: t("psy.mask"), v: p.mask },
    { k: "truth", label: t("psy.truth"), v: p.truth },
    { k: "wound", label: t("psy.wound"), v: p.wound },
    { k: "innerConflict", label: t("psy.innerConflict"), v: p.innerConflict },
  ].filter((r) => r.v);

  const speak = async () => {
    setVoiceState("loading");
    setLine("");
    try {
      const r = await fetch("/api/agent-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: { name: agent.name, role: agent.role, voice: agent.voice, relToN: agent.relToN, psyche: agent.psyche },
        }),
      });
      const j = await r.json().catch(() => ({ ok: false }));
      if (j.ok && j.content) {
        setLine(j.content);
        setVoiceState("done");
      } else {
        setVoiceState("fail");
      }
    } catch {
      setVoiceState("fail");
    }
  };

  return (
    <div className="agent-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="agent-card" role="dialog" aria-modal="true">
        <button className="agent-close" onClick={onClose} aria-label="close">
          ✕
        </button>
        <div className="agent-head">
          <div className="agent-initials">{agent.initials || agent.name.slice(0, 1)}</div>
          <div>
            <div className="agent-name">{agent.name}</div>
            <div className="agent-role">{agent.role}</div>
          </div>
        </div>

        {agent.relToN && agent.id !== "nietzsche" && (
          <div className="agent-rel">
            <span>{t("psy.relToN")}</span>
            {agent.relToN}
          </div>
        )}
        {agent.bio && <p className="agent-bio">{agent.bio}</p>}

        {agent.traits && agent.traits.length > 0 && (
          <div className="agent-tags">
            {agent.traits.map((x, i) => (
              <span key={i}>{x}</span>
            ))}
          </div>
        )}

        {/* AI voice — let this figure speak one line */}
        <div className="agent-voice">
          {voiceState === "done" && line && (
            <div className="agent-line">
              <span className="agent-quote">“</span>
              {line}
            </div>
          )}
          {voiceState === "fail" && <div className="agent-voice-fail">{t("voice.fail")}</div>}
          <button className="agent-voice-btn" onClick={speak} disabled={voiceState === "loading"}>
            {voiceState === "loading" ? t("voice.loading") : voiceState === "done" ? t("voice.again") : t("voice.cta", { name: agent.name })}
          </button>
        </div>

        <div className="agent-psyche">
          <div className="agent-sec">{t("psy.title")}</div>
          {rows.map((r) => (
            <div className="agent-prow" key={r.k}>
              <b>{r.label}</b>
              <span>{r.v}</span>
            </div>
          ))}
          {agent.voice && (
            <div className="agent-prow">
              <b>{t("psy.voice")}</b>
              <span>{agent.voice}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
