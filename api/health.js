import { MODELS } from "../lib/gemini.js";
import { SETTINGS, DURATIONS } from "../lib/settings.js";
import { json } from "../lib/http.js";

export const GET = () =>
  json({
    ok: true,
    keyConfigured: Boolean(process.env.GEMINI_API_KEY),
    accessCodeRequired: Boolean(process.env.ACCESS_CODE),
    models: MODELS,
    settings: Object.fromEntries(Object.entries(SETTINGS).map(([k, v]) => [k, { label: v.label, aspect: v.aspect }])),
    durations: DURATIONS,
  });
