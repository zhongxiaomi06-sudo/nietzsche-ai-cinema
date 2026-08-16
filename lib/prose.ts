import type { World, Dim } from "@/lib/world";
import { moodWord, type SimResult } from "@/lib/sim";

const CONN = [
  "",
  "然而笔不肯停。",
  "他知道自己正在被时间追赶。",
  "都灵的钟声照常响起，无人知晓。",
  "一种近乎残酷的清醒笼罩着他。",
  "他既是作者，也是自己即将写完的注脚。",
];

export type ProseBlock =
  | { kind: "lead"; text: string }
  | { kind: "prose"; who?: string; text: string }
  | { kind: "conn"; text: string }
  | { kind: "emerge"; text: string }
  | { kind: "micro"; items: string[] };

// Build the chapter prose as structured blocks (ported from chapterProse).
export function chapterProse(world: World, idx: number, res: SimResult): ProseBlock[] {
  const ch = world.chronology[idx];
  const mw = moodWord(res.worldMood);
  const blocks: ProseBlock[] = [];
  blocks.push({ kind: "lead", text: `${ch.date}。${ch.event}在都灵的${mw}里，他的笔比身体更先燃烧，也更先衰老。` });
  res.actors.forEach((a, k) => {
    let text = `${a.action || ""}`;
    if (a.action2) text += `；${a.action2}`;
    text += "。";
    const ms = [a.monologue, a.monologue2].filter(Boolean);
    if (ms.length) text += ms.map((x, i) => (i === 0 ? `他心里默念：「${x}」` : `又想：「${x}」`)).join("，");
    blocks.push({ kind: "prose", who: a.name, text });
    if (k === 0 && CONN[idx % CONN.length]) blocks.push({ kind: "conn", text: CONN[idx % CONN.length] });
  });
  if (res.emergent) blocks.push({ kind: "emerge", text: res.emergent });
  if (res.micro && res.micro.length) blocks.push({ kind: "micro", items: res.micro.slice(0, 6) });
  return blocks;
}

export const _dims = (w: World): Dim[] => (w.dims || []).map((d) => ({ k: d.k, name: d.name }));
