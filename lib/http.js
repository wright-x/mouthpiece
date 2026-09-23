import crypto from "node:crypto";
import { HttpError } from "./gemini.js";

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

export const cors = () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-access-code",
    },
  });

export function handle(fn) {
  return async (req) => {
    try {
      return await fn(req);
    } catch (e) {
      console.error(e);
      return json({ error: e.message || "Server error" }, e.status || 500);
    }
  };
}

// Optional gate so a public deployment can't burn your Veo credits.
export function checkAccess(req, fields = {}) {
  const code = process.env.ACCESS_CODE;
  if (!code) return;
  const given = req.headers.get("x-access-code") || fields.accessCode || new URL(req.url).searchParams.get("code");
  if (given !== code) throw new HttpError(401, "Wrong or missing access code");
}

// Accepts multipart/form-data (photo file) or JSON (photo as data URL / base64, or photoUrl).
export async function readInput(req) {
  const type = req.headers.get("content-type") || "";
  const out = {};
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    for (const [k, v] of form.entries()) {
      if (k === "photo" && typeof v !== "string") {
        out.photo = { mimeType: v.type || "image/jpeg", data: Buffer.from(await v.arrayBuffer()).toString("base64") };
      } else out[k] = v;
    }
  } else {
    Object.assign(out, await req.json().catch(() => ({})));
    if (typeof out.photo === "string") {
      const m = out.photo.match(/^data:([^;]+);base64,(.*)$/s);
      out.photo = m ? { mimeType: m[1], data: m[2] } : { mimeType: out.photoMimeType || "image/jpeg", data: out.photo };
    }
    if (!out.photo && out.photoUrl) {
      const r = await fetch(out.photoUrl);
      if (!r.ok) throw new HttpError(400, "Could not fetch photoUrl");
      out.photo = {
        mimeType: (r.headers.get("content-type") || "image/jpeg").split(";")[0],
        data: Buffer.from(await r.arrayBuffer()).toString("base64"),
      };
    }
  }
  return out;
}

// Stateless, signed job token: the whole job state rides along with each poll.
const secret = () => crypto.createHash("sha256").update("mouthpiece:" + (process.env.GEMINI_API_KEY || "")).digest();

export function encodeJob(job) {
  const body = Buffer.from(JSON.stringify(job)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url").slice(0, 22);
  return `${body}.${sig}`;
}

export function decodeJob(token) {
  const [body, sig] = String(token || "").split(".");
  const good = body && crypto.createHmac("sha256", secret()).update(body).digest("base64url").slice(0, 22);
  if (!body || sig !== good) throw new HttpError(400, "Invalid job token");
  return JSON.parse(Buffer.from(body, "base64url").toString());
}
