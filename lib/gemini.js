const BASE = "https://generativelanguage.googleapis.com/v1beta";

export const MODELS = {
  script: process.env.SCRIPT_MODEL || "gemini-3.8-flash",
  image: process.env.IMAGE_MODEL || "gemini-3.1-flash-image",
  // Cheapest Veo tier for single clips (4/6/8s). Lite can't extend videos,
  // so 15s+ jobs use Veo 3.1 Fast for the base clip and every extension.
  video: process.env.VIDEO_MODEL || "veo-3.1-lite-generate-preview",
  videoLong: process.env.VIDEO_LONG_MODEL || "veo-3.1-fast-generate-preview",
};

function key() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new HttpError(500, "GEMINI_API_KEY is not set on the server");
  return k;
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function call(path, body, method = "POST") {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: { "x-goog-api-key": key(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const msg = json?.error?.message || text.slice(0, 400);
    throw new HttpError(res.status >= 500 ? 502 : res.status, `Gemini (${path.split(":")[0]}): ${msg}`);
  }
  return json;
}

// ---------- 1. Script idea -> structured JSON (Gemini Flash) ----------
const SCRIPT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    voice: { type: "string", description: "Short description of the speaker's voice, e.g. 'warm male voice, mid-20s, slight Vietnamese-English accent'" },
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dialogue: { type: "string", description: "Exact words spoken to camera in this segment" },
          action: { type: "string", description: "What the person physically does / expression while speaking" },
          emotion: { type: "string" },
        },
        required: ["dialogue", "action", "emotion"],
      },
    },
  },
  required: ["title", "voice", "segments"],
};

export async function planScript({ idea, setting, segments, photo }) {
  const wordsFor = (s) => Math.max(6, Math.round(s * 2.3));
  const segSpec = segments
    .map((s, i) => `  - segment ${i + 1}: ${s} seconds, about ${wordsFor(s)} words max`)
    .join("\n");

  const prompt = `You write short talking-head video scripts for an AI avatar that speaks directly to camera.

Setting / vibe: ${setting.label} — ${setting.scene}
Default voice style: ${setting.voice}
The attached photo shows the speaker. The "voice" field must fit them (apparent gender and age).
Script idea from the user: """${idea}"""

Write exactly ${segments.length} segment(s):
${segSpec}

Rules:
- Dialogue is spoken aloud by one person to camera, natural and punchy, first person.
- Stay UNDER the word limit per segment — it must be comfortably speakable in the time.
- Segments flow as one continuous monologue; the last one lands a clear ending.
- No stage directions inside dialogue, no emojis, no hashtags, no quotation marks inside dialogue.
- "action" is a short physical direction (gesture, expression) that fits the setting.`;

  const json = await call(`models/${MODELS.script}:generateContent`, {
    contents: [{ role: "user", parts: [
      ...(photo ? [{ inlineData: { mimeType: photo.mimeType, data: photo.data } }] : []),
      { text: prompt },
    ] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: SCRIPT_SCHEMA,
      temperature: 0.9,
    },
  });

  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  let plan;
  try { plan = JSON.parse(text); } catch {
    throw new HttpError(502, "Script model returned invalid JSON");
  }
  // Force segment count to match the timing plan.
  plan.segments = (plan.segments || []).slice(0, segments.length);
  while (plan.segments.length < segments.length) {
    plan.segments.push({ dialogue: "", action: "smiles and nods", emotion: "warm" });
  }
  plan.segments = plan.segments.map((s, i) => ({ ...s, seconds: segments[i] }));
  return plan;
}

// ---------- 2. Photo -> stylized avatar keeping resemblance (Nano Banana) ----------
export async function makeAvatar({ photo, setting, aspect }) {
  const json = await call(`models/${MODELS.image}:generateContent`, {
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType: photo.mimeType, data: photo.data } },
        {
          text: `Create a photorealistic avatar portrait of THIS EXACT PERSON from the photo. Preserve their identity precisely: face shape, eyes, nose, mouth, skin tone, hair, facial hair and age must stay the same so they are instantly recognizable.

Style and scene: ${setting.avatar}

Framing: head and shoulders, centered, facing the camera, mouth closed in a natural relaxed expression, eyes looking into the lens, sharp focus on the face. No text, no watermark, no logos.`,
        },
      ],
    }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: aspect },
    },
  });

  const parts = json?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) {
    const reason = json?.candidates?.[0]?.finishReason || json?.promptFeedback?.blockReason || "no image returned";
    throw new HttpError(422, `Avatar generation failed (${reason}). Try a clearer, front-facing photo.`);
  }
  return { mimeType: img.inlineData.mimeType || "image/png", data: img.inlineData.data };
}

// ---------- 3. JSON segment -> Veo prompt ----------
export function veoPrompt({ plan, setting, index }) {
  const seg = plan.segments[index];
  const first = index === 0;
  return [
    first
      ? `${setting.scene}`
      : `Continue the same shot seamlessly: same person, same place, same lighting, same voice.`,
    `The person ${first ? "in the image " : ""}looks directly into the camera and speaks, with natural lip-sync, ${seg.emotion} energy, while they ${seg.action}.`,
    `They say, in a ${plan.voice || setting.voice}: "${seg.dialogue}"`,
    `Camera: ${setting.camera}.`,
    `Audio: clean, clearly intelligible dialogue, ${setting.ambience}. No background music.`,
    `No subtitles, no captions, no on-screen text.`,
  ].join(" ");
}

// ---------- 4. Veo: start / extend / poll ----------
export async function startVideo({ image, prompt, aspect, seconds, model = MODELS.video }) {
  const op = await call(`models/${model}:predictLongRunning`, {
    instances: [{ prompt, image: { bytesBase64Encoded: image.data, mimeType: image.mimeType } }],
    parameters: {
      aspectRatio: aspect,
      durationSeconds: seconds,
      resolution: "720p",
      personGeneration: "allow_adult",
      // Lite rejects negativePrompt; the main prompt already says "no subtitles".
      ...(model.includes("lite") ? {} : { negativePrompt: "subtitles, captions, text overlay, watermark, distorted face, extra people" }),
    },
  });
  return op.name;
}

// Extensions must request durationSeconds 8; Veo appends ~7s and returns the combined clip.
export async function extendVideo({ videoUri, prompt, aspect }) {
  const body = (video) => ({
    instances: [{ prompt, video }],
    parameters: { aspectRatio: aspect, durationSeconds: 8, resolution: "720p", personGeneration: "allow_adult" },
  });
  try {
    const op = await call(`models/${MODELS.videoLong}:predictLongRunning`, body({ uri: videoUri }));
    return op.name;
  } catch (e1) {
    // Fallback: send the previous clip inline.
    try {
      const bytes = await downloadVideo(videoUri);
      const data = Buffer.from(await bytes.arrayBuffer()).toString("base64");
      const op = await call(`models/${MODELS.videoLong}:predictLongRunning`, body({ bytesBase64Encoded: data, mimeType: "video/mp4" }));
      return op.name;
    } catch (e2) {
      throw new HttpError(e2.status || 502, `uri: ${e1.message} | inline: ${e2.message}`);
    }
  }
}

export async function getOperation(name) {
  const op = await call(name, null, "GET");
  if (!op.done) return { done: false };
  if (op.error) throw new HttpError(502, `Veo: ${op.error.message}`);
  const r = op.response?.generateVideoResponse;
  const uri = r?.generatedSamples?.[0]?.video?.uri;
  if (!uri) {
    const why = r?.raiMediaFilteredReasons?.join(" ") || "no video returned (possibly blocked by safety filters)";
    throw new HttpError(422, `Veo: ${why}`);
  }
  return { done: true, uri };
}

export async function downloadVideo(uri) {
  const res = await fetch(uri, { headers: { "x-goog-api-key": key() }, redirect: "follow" });
  if (!res.ok) throw new HttpError(502, `Video download failed (${res.status})`);
  return res;
}
