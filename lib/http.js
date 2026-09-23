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

// Gate so a public deployment can't burn your Veo credits.
// Exact, case-sensitive match, compared in constant time (hash both sides so
// lengths match and timingSafeEqual can't leak how many characters were right).
// Only accepted via header or body, never the URL, so it doesn't end up in logs.
const digest = (s) => crypto.createHash("sha256").update(String(s), "utf8").digest();

export async function checkAccess(req, fields = {}) {
  const code = process.env.ACCESS_CODE;
  if (!code) return;
  const given = req.headers.get("x-access-code") ?? fields.accessCode ?? "";
  const ok = typeof given === "string" && given.length > 0 && crypto.timingSafeEqual(digest(given), digest(code));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    throw new HttpError(401, "Wrong or missing access code");
  }
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
  }
  return out;
}

// Called only AFTER the access check, so strangers can't make the server fetch URLs.
export async function resolvePhoto(input) {
  if (input.photo?.data || !input.photoUrl) return input;
  const url = new URL(String(input.photoUrl));
  if (url.protocol !== "https:") throw new HttpError(400, "photoUrl must be https");
  const r = await fetch(url);
  const type = (r.headers.get("content-type") || "").split(";")[0];
  if (!r.ok || !type.startsWith("image/")) throw new HttpError(400, "photoUrl must point to an image");
  input.photo = { mimeType: type, data: Buffer.from(await r.arrayBuffer()).toString("base64") };
  return input;
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
