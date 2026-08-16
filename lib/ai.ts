import type { World, Dim } from "@/lib/world";
import type { Frame } from "@/lib/sim";
import { firstGodIdx } from "@/lib/sim";
import type { Report } from "@/components/FeedbackReport";

// Call the server AI proxy. Returns trimmed content or null (→ local fallback).
export async function callTwin(payload: Record<string, unknown>): Promise<string | null> {
  try {
    const r = await fetch("/api/twin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({ ok: false }));
    if (!j.ok || !j.content) return null;
    return String(j.content).trim() || null;
  } catch {
    return null;
  }
}

function parseJSONContent(content: string | null): Report | null {
  if (!content) return null;
  const fence = (s: string) => s.replace(/```json|```/gi, "").trim();
  const tryParse = (s: string): Report | null => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  let p = tryParse(content);
  if (!p) p = tryParse(fence(content));
  if (!p) p = tryParse(content.replace(/\r?\n/g, " "));
  if (!p) p = tryParse(fence(content).replace(/\r?\n/g, " "));
  if (!p) {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) p = tryParse(m[0].replace(/\r?\n/g, " "));
  }
  return p;
}

// AI rewrite of a chapter in Nietzsche's voice.
export async function aiRewriteChapter(world: World, dims: Dim[], idx: number, ch: Frame[], base: Frame[], god: Record<number, string>): Promise<string | null> {
  const chr = world.chronology[idx];
  const c = ch[idx];
  const before = (base[idx] && base[idx].state) || c.state;
  const delta =
    dims
      .map((d) => {
        const v = Math.round((c.state[d.k] || 0) - (before[d.k] || 0));
        if (!v) return null;
        return d.name + (v > 0 ? "+" : "") + v;
      })
      .filter(Boolean)
      .join("，") || "（与原线一致）";
  const sys =
    "你是哲学家弗里德里希·尼采的数字分身。读者刚刚注入了改写这一章命运的变量。请用尼采本人的语气——格言体、反讽、炽烈，带着痛苦与狂喜的张力——重写这一章的叙事散文。中文，150–230字。只写散文，不要解释、不要用引号包裹。";
  const user = `【章节】第${idx + 1}章《${chr.label}》${chr.date}\n【原事件】${chr.event}\n【读者注入的命运变量】${god[idx] || "（无，最忠于史料）"}\n【命运八维变化】${delta}\n【本章涌现洞察】${c.res.emergent || ""}\n请据此重写这一章：`;
  return callTwin({ messages: [{ role: "system", content: sys }, { role: "user", content: user }], params: { temperature: 0.95, max_tokens: 2400 } });
}

// Finale AI review.
export async function finaleReport(world: World, dims: Dim[], ch: Frame[], base: Frame[], god: Record<number, string>): Promise<Report> {
  const total = world.chronology.length;
  const godLog: string[] = [];
  for (let i = 0; i < total; i++) if (god[i]) godLog.push(`第${i + 1}章：${god[i]}`);
  const themes = (world.worldThemes || []).map((t) => t.name).join("、");
  const stateLine = dims.map((d) => `${d.name}:${Math.round(ch[total - 1].state[d.k] || 0)}`).join(" ");
  const traj = ch
    .map((c, i) => {
      const evs = (c.res.events || []).map((e) => e.text).filter(Boolean).join("；");
      return `· 第${i + 1}章《${world.chronology[i].label}》${world.chronology[i].date}｜${evs}`;
    })
    .join("\n");
  const sys =
    '你是「数字分身」的 ReportAgent。基于一条已跑完的尼采平行世界线，写出深度复盘：为何如此收场？哪些宏观文明力场被激活？上帝视角变量如何改写命运？文风肃穆、文学化、带学术分寸；不编造史料。只返回 JSON：{"title":"复盘标题","summary":"一句话总览(40-90字)","themes":[{"name":"力场名","note":"该力场在此线如何显现(20-50字)"}],"why":"为何如此收场(60-140字)","forkMeaning":"上帝视角变量的意义(40-110字；若无则说明最忠于史料)","ending":"收束判词(14-40字)","recur":"永恒轮回之问的回响(20-60字)","closing":"尼采式尾声(14-40字)"}';
  const user = `【宏观文明力场库】${themes}\n\n【终态生命向量】${stateLine}\n\n【上帝视角注入】${godLog.length ? godLog.join("；") : "（无——最忠于史料，无人从外部改写）"}\n\n【演化轨迹】\n${traj}\n\n请写出终幕复盘，只返回 JSON。`;
  const content = await callTwin({ messages: [{ role: "system", content: sys }, { role: "user", content: user }], params: { temperature: 0.85, max_tokens: 4096, response_format: { type: "json_object" } } });
  const p = parseJSONContent(content);
  if (p && p.summary) return p;
  return { localHtml: localReportFallback(world, dims, ch, base, god) };
}

function localReportFallback(world: World, dims: Dim[], ch: Frame[], base: Frame[], god: Record<number, string>): string {
  const total = world.chronology.length;
  const cur = ch[total - 1].state;
  const b = base[total - 1].state;
  const top = [...dims]
    .sort((a, z) => (cur[z.k] || 0) - (cur[a.k] || 0))
    .slice(0, 3)
    .map((d) => d.name)
    .join("·");
  const dl =
    dims
      .map((d) => {
        const v = Math.round((cur[d.k] || 0) - (b[d.k] || 0));
        return v ? `${d.name}${v > 0 ? "+" : ""}${v}` : null;
      })
      .filter(Boolean)
      .join("，") || "（与原线一致）";
  const hasGod = Object.keys(god).length > 0;
  return `<div class="rep-summary">一条由你的介入改写的世界线：终态以 ${top} 为主导。</div><div class="rep-line">命运偏移：${dl}。${hasGod ? "你注入的变量，让都灵的秋光拐向了另一条河。" : "这是最忠于史料的一次自行流淌。"}</div><div class="rep-closing">世界线签名：一条只属于你的尼采。</div>`;
}

// Dialogue with the twin, contextualized by the current chapter.
export async function dialogTwin(world: World, dims: Dim[], idx: number, ch: Frame[], god: Record<number, string>, q: string): Promise<string> {
  const chr = world.chronology[idx];
  const actorIds = chr.actors || [];
  const ctx = actorIds
    .map((id) => {
      const a = world.agents.find((x) => x.id === id);
      if (!a) return "";
      return `【${a.name}】声音：${a.voice || ""}；与尼采：${a.relToN || ""}；生平：${(a.bio || "").slice(0, 80)}`;
    })
    .filter(Boolean)
    .join("\n");
  const stateLine = dims.map((d) => `${d.name}:${Math.round(ch[idx].state[d.k] || 0)}`).join(" ");
  const sys = `你是哲学家弗里德里希·尼采的数字分身，正与一位读者对话。请用尼采本人的口吻——格言体、反讽、炽烈、带痛苦与狂喜的张力，常有反问。只基于以下语料作答，不编造无关史实。\n语料：\n${ctx}\n\n【当前所在】第${idx + 1}章《${chr.label}》\n【当前命运八维】${stateLine}\n【读者已注入的改写】${god[idx] || "（无）"}`;
  const content = await callTwin({ messages: [{ role: "system", content: sys }, { role: "user", content: q }], params: { temperature: 0.9, max_tokens: 2000 } });
  return content && content.trim() ? content.trim() : "（此刻神明暂时沉默——AI 通道不可用，但命运线仍在你手中。）";
}

export { firstGodIdx };
