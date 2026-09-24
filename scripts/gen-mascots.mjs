import { writeFile } from "node:fs/promises";
import path from "node:path";

const API_KEY = process.env.VENICE_INFERENCE_KEY;
if (!API_KEY) {
  console.error("Set VENICE_INFERENCE_KEY in the environment before running.");
  process.exit(1);
}

const OUT_DIR = path.join(import.meta.dirname, "..", "public", "mascots");

const NEGATIVE =
  "nudity, nsfw, sexual content, revealing clothing, underwear, lingerie, explicit, bare skin, cleavage, suggestive pose";

const PROMPTS = [
  {
    file: "mascot-2.png",
    prompt:
      "Comedic police booking mugshot photo of an exaggerated cartoonish woman with absurdly huge fake eyelashes, drawn-on eyebrows, cheap gold hoop earrings, messy bleached hair with dark roots, wearing a bright orange prison jumpsuit zipped to the neck, standing in front of a gray cinderblock wall with a height chart and a black booking placard, deadpan bored expression, harsh direct flash photography, satirical meme aesthetic, fully clothed, tasteful, family-friendly",
  },
  {
    file: "mascot-3.png",
    prompt:
      "Comedic police booking mugshot photo of an exaggerated cartoonish man with a ridiculous thin mustache, gold grill teeth, slicked back hair, gaudy chain necklace over an orange prison jumpsuit zipped to the neck, smug smirking expression, standing in front of a gray cinderblock wall with a height chart and black booking placard, harsh direct flash photography, satirical meme aesthetic, fully clothed, tasteful, family-friendly",
  },
  {
    file: "mascot-4.png",
    prompt:
      "Comedic police booking mugshot photo of an exaggerated cartoonish woman with tired bloodshot eyes, smeared mascara, wild frizzy hair, gap teeth, wearing an oversized bright orange prison jumpsuit zipped to the neck, exhausted unimpressed expression, standing in front of a gray cinderblock wall with a height chart and black booking placard, harsh direct flash photography, satirical meme aesthetic, fully clothed, tasteful, family-friendly",
  },
  {
    file: "mascot-5.png",
    prompt:
      "Comedic police booking mugshot photo of an exaggerated cartoonish woman with enormous inflated duck-lip filler, heavy contour makeup, huge hoop earrings, animal-print headband, wearing a bright orange prison jumpsuit zipped to the neck, dramatic eye-roll expression, standing in front of a gray cinderblock wall with a height chart and black booking placard, harsh direct flash photography, satirical meme aesthetic, fully clothed, tasteful, family-friendly",
  },
];

async function generate({ file, prompt }) {
  const res = await fetch("https://api.venice.ai/api/v1/image/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "flux-2-pro",
      prompt,
      negative_prompt: NEGATIVE,
      width: 1024,
      height: 1024,
      safe_mode: true,
      format: "png",
    }),
  });

  if (!res.ok) {
    throw new Error(`${file}: HTTP ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const b64 = data.images?.[0];
  if (!b64) throw new Error(`${file}: no image returned: ${JSON.stringify(data).slice(0, 300)}`);

  await writeFile(path.join(OUT_DIR, file), Buffer.from(b64, "base64"));
  console.log(`wrote ${file}`);
}

for (const p of PROMPTS) {
  await generate(p);
}
