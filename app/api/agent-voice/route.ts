import { NextRequest } from "next/server";
import { appAiChat, AppAIUnavailableError } from "@/lib/app-ai";

export const runtime = "nodejs";

// Speaks ONE line in the voice of any relation-graph agent, grounded in their
// psyche data. Public no-login experience → no requireAuth. Returns { ok, content }.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const a = body?.agent;
  if (!a || typeof a.name !== "string") {
    return Response.json({ ok: false, error: "no-agent" }, { status: 400 });
  }
  const p = a.psyche || {};
  const psycheLines = [
    p.archetype && `原型：${p.archetype}`,
    p.desire && `欲望：${p.desire}`,
    p.fear && `恐惧：${p.fear}`,
    p.contradiction && `矛盾：${p.contradiction}`,
    p.mask && `面具：${p.mask}`,
    p.truth && `真相：${p.truth}`,
    p.wound && `伤口：${p.wound}`,
    p.innerConflict && `内在冲突：${p.innerConflict}`,
  ]
    .filter(Boolean)
    .join("\n");

  const sys = `你要扮演《尼采·最后的十二年》里的历史人物「${a.name}」（${a.role || ""}）。请完全以 TA 本人的第一人称口吻、说话风格，说出一句直击内心的话——像一句从灵魂里漏出来的独白或对尼采的低语。
【说话风格】${a.voice || "符合该人物身份"}
【与尼采的关系】${a.relToN || ""}
【内心剖面】
${psycheLines}
要求：只输出这一句中文，40字以内，不要引号、不要解释、不要旁白、不要以「我是…」开头。要有文学质地与人物的真实矛盾感。`;

  try {
    const result = await appAiChat({
      capability: "text",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `请以${a.name}的口吻，说一句此刻最想说的话。` },
      ],
      params: { temperature: 1.0, max_tokens: 200 },
    });
    let content = (result?.choices?.[0]?.message?.content || "").toString().replace(/\r/g, " ").trim();
    content = content.replace(/^[「"'“]+|[」"'”]+$/g, "").trim();
    if (!content) return Response.json({ ok: false, error: "empty" });
    return Response.json({ ok: true, content });
  } catch (error) {
    if (error instanceof AppAIUnavailableError) {
      return Response.json({ ok: false, error: "app_ai_unavailable" });
    }
    return Response.json({ ok: false, error: "upstream" });
  }
}
