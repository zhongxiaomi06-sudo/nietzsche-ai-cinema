import { NextRequest } from "next/server";
import { appAiChat, AppAIUnavailableError } from "@/lib/app-ai";

export const runtime = "nodejs";

// Replaces the original DeepSeek /api/twin proxy. The client sends { messages, params }
// and receives { ok, content } — the AI-in-Nietzsche's-voice text, or ok:false to fall
// back to the local simulation. No-login public experience, so no requireAuth.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return Response.json({ ok: false, error: "no-messages" }, { status: 400 });
  }

  try {
    const result = await appAiChat({
      capability: "text",
      messages,
      params: body.params ?? {},
    });
    const content = (result?.choices?.[0]?.message?.content || "").toString().replace(/\r/g, " ").trim();
    if (!content) return Response.json({ ok: false, error: "empty" });
    return Response.json({ ok: true, content });
  } catch (error) {
    if (error instanceof AppAIUnavailableError) {
      return Response.json({ ok: false, error: "app_ai_unavailable" });
    }
    return Response.json({ ok: false, error: "upstream" });
  }
}
