"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { World, Dim } from "@/lib/world";
import { loadWorld, BRANCHES } from "@/lib/world";
import { simTrajectory, firstGodIdx, type Frame } from "@/lib/sim";
import { chapterProse } from "@/lib/prose";
import { aiRewriteChapter, finaleReport, dialogTwin } from "@/lib/ai";
import { SidePanel } from "./SidePanel";
import { GodModal, DialogModal, type ChatMsg } from "./Modals";
import { FeedbackModal, ReportModal, type Fb, type Report } from "./FeedbackReport";
import { useI18n } from "@/lib/i18n";

type God = Record<number, string>;

export default function CinemaExperience() {
  const { t, locale, setLocale } = useI18n();
  const [world, setWorld] = useState<World | null>(null);
  const [dims, setDims] = useState<Dim[]>([]);
  const [god, setGod] = useState<God>({});
  const [cur, setCur] = useState(0);
  const [entered, setEntered] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // AI narrative per chapter
  const [aiNarr, setAiNarr] = useState<Record<number, { state: "loading" | "done" | "fail"; text: string }>>({});
  const [fateToast, setFateToast] = useState<string | null>(null);
  const [pendingFork, setPendingFork] = useState<number | null>(null);

  // modals
  const [godIdx, setGodIdx] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chatLog, setChatLog] = useState<ChatMsg[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [fbOpen, setFbOpen] = useState(false);
  const [wall, setWall] = useState<Fb[] | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<(HTMLElement | null)[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadWorld()
      .then((w) => {
        setWorld(w);
        setDims((w.dims || []).map((d) => ({ k: d.k, name: d.name })));
      })
      .catch(() => {});
  }, []);

  const base: Frame[] = useMemo(() => (world ? simTrajectory(world, dims, {}) : []), [world, dims]);
  const ch: Frame[] = useMemo(() => (world ? simTrajectory(world, dims, god) : []), [world, dims, god]);
  const total = world ? world.chronology.length : 0;
  const firstFork = useMemo(() => firstGodIdx(god, total), [god, total]);

  const runAiRewrite = useCallback(
    async (idx: number, force?: boolean) => {
      if (!world) return;
      if (!force && aiNarr[idx]?.state === "done") return;
      setAiNarr((p) => ({ ...p, [idx]: { state: "loading", text: "" } }));
      const content = await aiRewriteChapter(world, dims, idx, ch, base, god);
      if (content && content.trim()) {
        setAiNarr((p) => ({ ...p, [idx]: { state: "done", text: content.trim() } }));
      } else {
        setAiNarr((p) => ({ ...p, [idx]: { state: "fail", text: "" } }));
      }
    },
    [world, dims, ch, base, god, aiNarr],
  );

  const showFate = useCallback(
    (fi: number) => {
      if (!base.length || !ch.length) return;
      const last = total - 1;
      let maxK: Dim | null = null,
        maxV = 0,
        totalOffset = 0;
      dims.forEach((d) => {
        const v = (ch[last].state[d.k] || 0) - (base[last].state[d.k] || 0);
        totalOffset += Math.abs(v);
        if (Math.abs(v) > Math.abs(maxV)) {
          maxV = v;
          maxK = d;
        }
      });
      const downstream = last - fi;
      const kName = maxK ? (maxK as Dim).name : "-";
      setFateToast(`你改写了第 ${fi + 1} 章，${downstream} 个下游章节因此改写；终态最大偏移：${kName} ${maxV > 0 ? "+" : ""}${Math.round(maxV)}；全程累计偏移 ${Math.round(totalOffset)}。`);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setFateToast(null), 5200);
    },
    [base, ch, dims, total],
  );

  const applyGod = useCallback((i: number, v: string) => {
    setGod((prev) => {
      const next = { ...prev };
      if (v) next[i] = v;
      else delete next[i];
      return next;
    });
    if (v) setPendingFork(i);
  }, []);

  // After the trajectory recomputes (ch/god updated), run AI rewrite + fate toast
  // against the FRESH trajectory — never a stale closure.
  useEffect(() => {
    if (pendingFork === null || !world || !ch.length || !base.length) return;
    const i = pendingFork;
    setPendingFork(null);
    runAiRewrite(i, true);
    showFate(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFork, ch]);

  // scroll activation
  useEffect(() => {
    if (!entered || !world) return;
    const root = stageRef.current;
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.i);
            setCur(idx);
          }
        });
      },
      { root, threshold: 0.5 },
    );
    sceneRefs.current.forEach((s) => s && io.observe(s));
    return () => io.disconnect();
  }, [entered, world]);

  const scrollTo = (i: number) => sceneRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });

  const loadWall = useCallback(async () => {
    try {
      const r = await fetch("/api/feedback");
      const arr = await r.json();
      setWall(Array.isArray(arr) ? arr : []);
    } catch {
      setWall([]);
    }
  }, []);

  const submitFb = useCallback(
    async (role: string, score: number, text: string) => {
      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, score, text, chapter: cur }),
        });
        await loadWall();
      } catch {}
    },
    [cur, loadWall],
  );

  const sendChat = useCallback(
    async (q: string) => {
      if (!world) return;
      setChatLog((p) => [...p, { role: "u", text: q }]);
      setChatBusy(true);
      const ans = await dialogTwin(world, dims, cur, ch, god, q);
      setChatLog((p) => [...p, { role: "a", text: ans }]);
      setChatBusy(false);
    },
    [world, dims, cur, ch, god],
  );

  const openReport = useCallback(async () => {
    if (!world) return;
    setReportOpen(true);
    setReportLoading(true);
    setReport(null);
    const r = await finaleReport(world, dims, ch, base, god);
    setReport(r);
    setReportLoading(false);
  }, [world, dims, ch, base, god]);

  if (!world) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", color: "var(--gold)", fontFamily: "var(--serif)" }}>
        正在进入《尼采 · 最后的十二年》…
      </div>
    );
  }

  return (
    <>
      <div className="lang-switch">
        <button className={locale === "zh-CN" ? "on" : ""} onClick={() => setLocale("zh-CN")}>
          中
        </button>
        <button className={locale === "en-US" ? "on" : ""} onClick={() => setLocale("en-US")}>
          EN
        </button>
      </div>

      <div className={`intro ${entered ? "hide" : ""}`}>
        <div className="kicker">{t("intro.kicker")}</div>
        <h1>{t("intro.title")}</h1>
        <p className="sub">{t("intro.sub")}</p>
        <button className="enter" onClick={() => setEntered(true)}>
          {t("intro.enter")}
        </button>
      </div>

      <div ref={stageRef} className="no-scrollbar" style={{ height: "100vh", overflowY: "scroll", scrollSnapType: "y mandatory", scrollBehavior: "smooth" }}>
        {world.chronology.map((chr, idx) => {
          const c = ch[idx];
          if (!c) return null;
          const forked = !!god[idx];
          const blocks = chapterProse(world, idx, c.res);
          const narr = aiNarr[idx];
          const gd = c.godDeltas || {};
          const gdl = dims
            .map((d) => {
              const v = gd[d.k] || 0;
              return v ? { name: d.name, v } : null;
            })
            .filter(Boolean) as { name: string; v: number }[];
          return (
            <section
              key={idx}
              data-i={idx}
              ref={(el) => {
                sceneRefs.current[idx] = el;
              }}
              className={`scene ${cur === idx ? "view" : ""} ${forked ? "forked" : ""}`}
            >
              <div className="bg" style={{ backgroundImage: `url('/scenes/act${idx}.png')` }} />
              <div className="scrim" />
              <div className="content no-scrollbar">
                {forked && <span className="fork-badge">{t("fork.badge")}</span>}
                <div className="ch-index">{t("ch.of", { i: idx + 1, n: total })}</div>
                <h1 className="ch-title">{chr.label}</h1>
                <div className="ch-date">{chr.date}</div>
                {blocks.map((b, k) => {
                  if (b.kind === "lead") return <p className="prose-lead" key={k}>{b.text}</p>;
                  if (b.kind === "emerge") return <p className="prose emerge" key={k}>{b.text}</p>;
                  if (b.kind === "conn") return <p className="prose" key={k}>{b.text}</p>;
                  if (b.kind === "micro")
                    return (
                      <div className="micro-foot" key={k}>
                        {b.items.map((x, j) => (
                          <span key={j}>{x}</span>
                        ))}
                      </div>
                    );
                  return (
                    <p className="prose" key={k}>
                      {b.who && <span className="who">{b.who}</span>}
                      {b.text}
                    </p>
                  );
                })}

                {forked && (
                  <div className="gdone">
                    <span className="gd-tag">{t("god.done")}</span>
                    <div className="gd-text">上帝视角：「{god[idx]}」</div>
                    {gdl.length > 0 && (
                      <div className="gd-deltas">
                        {t("god.offset")}
                        {gdl.map((g, j) => (
                          <b key={j} className={g.v > 0 ? "up" : "down"}>
                            {" "}
                            {g.name}
                            {g.v > 0 ? "+" : ""}
                            {g.v}{" "}
                            {j < gdl.length - 1 ? "·" : ""}
                          </b>
                        ))}
                      </div>
                    )}
                    <div className="gd-deltas" style={{ color: "var(--faint)", marginTop: 4 }}>
                      {t("god.downstream")}
                    </div>
                  </div>
                )}

                {narr && (
                  <div className="ai-narr">
                    {narr.state === "loading" && (
                      <div className="an-tag">
                        <span className="dot" />
                        {t("ai.rewriting")}
                      </div>
                    )}
                    {narr.state === "done" && (
                      <>
                        <div className="an-tag">
                          <span className="dot" />
                          {t("ai.rewritten")}
                        </div>
                        <div className="an-text">{narr.text}</div>
                        <button className="an-regen" onClick={() => runAiRewrite(idx, true)}>
                          {t("ai.regen")}
                        </button>
                      </>
                    )}
                    {narr.state === "fail" && (
                      <div className="an-tag">
                        <span className="dot" style={{ background: "var(--down)" }} />
                        {t("ai.unavail")}
                      </div>
                    )}
                  </div>
                )}

                <div className="actions">
                  <button className="btn fork" onClick={() => setGodIdx(idx)}>
                    {t("act.edit")}
                  </button>
                  <button className="btn" onClick={() => runAiRewrite(idx, true)}>
                    {t("act.ai")}
                  </button>
                  {idx === total - 1 && (
                    <button className="btn" onClick={openReport}>
                      {t("act.report")}
                    </button>
                  )}
                  <button className="btn" onClick={() => scrollTo(idx)}>
                    {t("act.top")}
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* FABs */}
      <div className="fabs">
        <button className="fab" title={t("fab.panel")} onClick={() => setPanelOpen((v) => !v)}>
          ◎
        </button>
        <button className="fab" title={t("fab.dialog")} onClick={() => setDialogOpen(true)}>
          💬
        </button>
        <button className="fab" title={t("fab.feedback")} onClick={() => { setFbOpen(true); loadWall(); }}>
          ✍
        </button>
      </div>

      <div className={`panel-scrim ${panelOpen ? "show" : ""}`} onClick={() => setPanelOpen(false)} />
      <SidePanel open={panelOpen} world={world} dims={dims} idx={cur} ch={ch} base={base} firstFork={firstFork} onClose={() => setPanelOpen(false)} onBranch={(k) => { const b = BRANCHES[cur][k]; applyGod(cur, b.v); }} onApplyGambit={(text) => { applyGod(cur, text); setPanelOpen(false); }} />

      <GodModal open={godIdx !== null} idx={godIdx ?? 0} initial={godIdx !== null ? god[godIdx] || "" : ""} onCancel={() => setGodIdx(null)} onApply={(v) => { if (godIdx !== null) applyGod(godIdx, v); setGodIdx(null); }} />
      <DialogModal open={dialogOpen} log={chatLog} busy={chatBusy} onClose={() => setDialogOpen(false)} onSend={sendChat} />
      <FeedbackModal open={fbOpen} wall={wall} onClose={() => setFbOpen(false)} onSubmit={submitFb} onLoadWall={loadWall} />
      <ReportModal open={reportOpen} loading={reportLoading} report={report} onClose={() => setReportOpen(false)} />

      <div className={`fate-toast ${fateToast ? "show" : ""}`}>
        {fateToast && (
          <>
            <div className="ft-head">⚡ 命运分叉</div>
            <div className="ft-body">{fateToast}</div>
          </>
        )}
      </div>
    </>
  );
}
