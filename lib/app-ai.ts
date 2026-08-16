// Server-side App AI helper — routes viewer usage through the Eazo App AI billing proxy.
type AppAiMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

export class AppAIUnavailableError extends Error {}

export async function appAiChat(input: {
  capability?: "text" | "vision" | "image_generation";
  messages: AppAiMessage[];
  params?: Record<string, unknown>;
  viewerUserId?: string;
}) {
  const platformBase = process.env.EAZO_APP_AI_API_BASE?.replace(/\/$/, "");
  const appId = process.env.EAZO_APP_ID || process.env.NEXT_PUBLIC_EAZO_APP_ID;
  const privateKey = process.env.EAZO_PRIVATE_KEY;
  const capability = input.capability || "text";
  const modelMap = process.env.EAZO_AI_MODELS_JSON ? JSON.parse(process.env.EAZO_AI_MODELS_JSON) : {};
  const modelKey =
    typeof modelMap[capability] === "string" ? modelMap[capability] : process.env.EAZO_AI_MODEL_KEY;

  if (!platformBase || !appId || !privateKey || !modelKey) {
    throw new AppAIUnavailableError("App AI is not configured.");
  }

  const res = await fetch(`${platformBase}/api/app-ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-eazo-app-id": appId,
      Authorization: `Bearer ${privateKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      model_key: modelKey,
      messages: input.messages,
      viewer_user_id: input.viewerUserId,
      stream: false,
      params: input.params ?? {},
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res
      .clone()
      .json()
      .catch(() => null);
    const code = body?.detail?.code || body?.code;
    if (res.status === 402 && code === "app_ai_unavailable") {
      throw new AppAIUnavailableError();
    }
    const text = await res.text().catch(() => "");
    throw new Error(`App AI request failed: ${res.status} ${text.slice(0, 200)}`);
  }

  return res.json();
}
