import { SETTINGS, segmentPlan } from "./settings.js";
import { planScript, makeAvatar, veoPrompt, startVideo, extendVideo, getOperation, HttpError } from "./gemini.js";
import { encodeJob, decodeJob } from "./http.js";

export async function createJob(input) {
  const settingKey = String(input.setting || "ugc").toLowerCase();
  const setting = SETTINGS[settingKey];
  if (!setting) throw new HttpError(400, `Unknown setting. Use one of: ${Object.keys(SETTINGS).join(", ")}`);
  if (!input.photo?.data) throw new HttpError(400, "Missing photo (multipart field 'photo', JSON 'photo' base64/data URL, or 'photoUrl')");
  const idea = String(input.idea || input.script || "").trim() || "Introduce yourself in a fun, confident way.";
  const aspect = ["16:9", "9:16"].includes(input.aspect) ? input.aspect : setting.aspect;
  const segments = segmentPlan(input.duration);

  // Script JSON (Flash) and avatar (Nano Banana) run in parallel.
  const [plan, avatar] = await Promise.all([
    planScript({ idea, setting, segments }),
    makeAvatar({ photo: input.photo, setting, aspect }),
  ]);

  const prompt = veoPrompt({ plan, setting, index: 0 });
  const op = await startVideo({ image: avatar, prompt, aspect, seconds: segments[0] });

  const job = { op, i: 0, s: settingKey, a: aspect, plan };
  return {
    status: "rendering",
    job: encodeJob(job),
    step: 1,
    steps: segments.length,
    setting: settingKey,
    aspect,
    duration: segments.reduce((a, b) => a + b, 0),
    plan,
    avatar: `data:${avatar.mimeType};base64,${avatar.data}`,
  };
}

export async function advanceJob(token) {
  const job = decodeJob(token);
  const steps = job.plan.segments.length;
  const base = { step: job.i + 1, steps, plan: job.plan };

  const r = await getOperation(job.op);
  if (!r.done) return { status: "rendering", job: token, ...base };

  const videoUrl = `/api/video?uri=${encodeURIComponent(r.uri)}`;
  if (job.i + 1 >= steps) return { status: "done", videoUrl, ...base };

  // Chain the next ~7s extension, carrying the same voice and scene.
  const setting = SETTINGS[job.s];
  const i = job.i + 1;
  try {
    const op = await extendVideo({
      videoUri: r.uri,
      prompt: veoPrompt({ plan: job.plan, setting, index: i }),
      aspect: job.a,
      seconds: job.plan.segments[i].seconds,
    });
    const next = { ...job, op, i };
    return { status: "rendering", job: encodeJob(next), step: i + 1, steps, plan: job.plan, partialVideoUrl: videoUrl };
  } catch (e) {
    return { status: "done", videoUrl, ...base, warning: `Stopped early, extension failed: ${e.message}` };
  }
}
