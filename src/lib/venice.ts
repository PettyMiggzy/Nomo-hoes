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

export async function veniceChat(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const res = await veniceFetch("/chat/completions", {
    model: CHAT_MODEL,
    temperature: 0.9,
    max_tokens: 400,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    venice_parameters: { include_venice_system_prompt: false },
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "...";
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
