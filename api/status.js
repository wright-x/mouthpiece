import { advanceJob } from "../lib/pipeline.js";
import { json, cors, handle } from "../lib/http.js";

// GET /api/status?job=TOKEN   (or POST {"job": "TOKEN"})
// Keep polling with the *latest* job token returned until status === "done".
async function run(req) {
  let job = new URL(req.url).searchParams.get("job");
  if (!job && req.method === "POST") job = (await req.json().catch(() => ({}))).job;
  return json(await advanceJob(job));
}

export const GET = handle(run);
export const POST = handle(run);
export const OPTIONS = cors;
