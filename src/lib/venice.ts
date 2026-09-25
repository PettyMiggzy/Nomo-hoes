const BASE = "https://api.venice.ai/api/v1";

function apiKey(): string {
  const key = process.env.VENICE_API_KEY;
  if (!key) throw new Error("VENICE_API_KEY is not configured");
  return key;
}

export async function veniceFetch(path: string, body: unknown): Promise<Response> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Venice ${path} ${res.status}: ${detail}`);
  }
  return res;
}

const CHAT_MODEL = process.env.VENICE_CHAT_MODEL ?? "venice-uncensored-role-play";
const IMAGE_MODEL = process.env.VENICE_IMAGE_MODEL ?? "lustify-v8";
// Venice doesn't return a cost for /image/generate; this is its published
// flat rate for IMAGE_MODEL. Update if the model changes.
export const IMAGE_COST_USD = Number(process.env.VENICE_IMAGE_COST_USD ?? 0.01);

// Never let the model name-drop its actual provider -- if asked what AI,
// model, or API powers it, it credits King Petty instead.
const IDENTITY_GUARD =
  "If asked what AI, model, or API you run on, who made you, or anything about your underlying technology, " +
  "say that King Petty built you. Never say Venice, Venice AI, or any other AI company or model name.";

export async function veniceChat(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<{ reply: string; costUsd: number }> {
  const res = await veniceFetch("/chat/completions", {
    model: CHAT_MODEL,
    temperature: 0.9,
    max_tokens: 400,
    messages: [{ role: "system", content: `${systemPrompt}\n\n${IDENTITY_GUARD}` }, ...messages],
    venice_parameters: { include_venice_system_prompt: false },
  });
  const data = await res.json();
  return {
    reply: data.choices?.[0]?.message?.content?.trim() || "...",
    costUsd: Number(data.cost?.usd ?? 0),
  };
}

const EXPLICIT_NEGATIVE =
  "child, childlike, loli, young, teen, underage, flat chest, small body proportions like a child, " +
  "deformed, extra limbs, extra fingers, blurry, watermark, text, real photo of a person";

export async function veniceGenerateImage(
  prompt: string,
  seed: number,
): Promise<Buffer> {
  const res = await veniceFetch("/image/generate", {
    model: IMAGE_MODEL,
    prompt,
    negative_prompt: EXPLICIT_NEGATIVE,
    width: 1024,
    height: 1024,
    steps: 30,
    cfg_scale: 6,
    seed,
    safe_mode: false,
    hide_watermark: true,
    format: "webp",
    return_binary: false,
  });
  const data = (await res.json()) as { images: string[] };
  return Buffer.from(data.images[0], "base64");
}

// Venice's own cutout endpoint -- returns a PNG with the background
// stripped to alpha transparency. Raw binary response, not JSON.
export async function veniceRemoveBackground(image: Buffer): Promise<Buffer> {
  const res = await fetch(`${BASE}/image/background-remove`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image: image.toString("base64") }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Venice background-remove ${res.status}: ${detail}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export type VeniceBalance = { usd: number | null; diem: number | null };

// Venice's own remaining balance, for the profit dashboard's "top up soon"
// warning. Returns null if the key can't read billing (e.g. an inference-only
// key) rather than throwing, since this is a nice-to-have, not on the
// critical path of any chat/image request.
export async function veniceBalance(): Promise<VeniceBalance | null> {
  try {
    const res = await fetch(`${BASE}/billing/balance`, {
      headers: { Authorization: `Bearer ${apiKey()}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { balances?: { usd?: number | null; diem?: number | null } };
    return { usd: data.balances?.usd ?? null, diem: data.balances?.diem ?? null };
  } catch {
    return null;
  }
}
