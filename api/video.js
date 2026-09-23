import { downloadVideo, HttpError } from "../lib/gemini.js";
import { handle } from "../lib/http.js";

// GET /api/video?uri=...  — streams the Veo file (Google needs the API key, so we proxy it).
export const GET = handle(async (req) => {
  const params = new URL(req.url).searchParams;
  const uri = params.get("uri") || "";
  if (!/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/files\/[\w-]+:download/.test(uri)) {
    throw new HttpError(400, "Invalid video uri");
  }
  const res = await downloadVideo(uri);
  const headers = {
    "Content-Type": "video/mp4",
    "Cache-Control": "public, max-age=86400, immutable",
    "Access-Control-Allow-Origin": "*",
  };
  const len = res.headers.get("content-length");
  if (len) headers["Content-Length"] = len;
  if (params.get("download")) headers["Content-Disposition"] = 'attachment; filename="mouthpiece.mp4"';
  return new Response(res.body, { status: 200, headers });
});
