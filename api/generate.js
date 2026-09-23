import { createJob, advanceJob } from "../lib/pipeline.js";
import { json, cors, handle, checkAccess, readInput } from "../lib/http.js";

// POST /api/generate
//   photo     (file | base64 | data URL)  or  photoUrl
//   setting   ugc | office | fantasy | cyberpunk | podcast | noir
//   idea      free-text script idea
//   duration  4 | 6 | 8 | 15 | 22 | 29   (seconds)
//   aspect    optional "16:9" | "9:16"
//   ?wait=1   block (up to ~4.5 min) and return the finished video if it's ready
export const POST = handle(async (req) => {
  const input = await readInput(req);
  checkAccess(req, input);
  const started = Date.now();
  let out = await createJob(input);

  const wait = new URL(req.url).searchParams.get("wait") || input.wait;
  if (wait && wait !== "0") {
    while (out.status === "rendering" && Date.now() - started < 270_000) {
      await new Promise((r) => setTimeout(r, 8000));
      const next = await advanceJob(out.job);
      out = { ...out, ...next };
    }
  }
  return json(out);
});

export const OPTIONS = cors;
