# MOUTHPIECE

Photo in, talking AI avatar video out. One key: `GEMINI_API_KEY`.

```
photo + setting ─┐
                 ├─► Nano Banana (gemini-3.1-flash-image) ─► avatar that looks like you
idea + duration ─┴─► Gemini Flash (gemini-3.8-flash) ─► JSON script {voice, segments[dialogue, action, emotion]}
                                                         │
                             avatar (first frame) + JSON ─► Veo 3.1 ─► 4/6/8s clip with voice + lip-sync
                                                         └─► longer? chain 7s Veo extensions (15/22/29s)
```

No ElevenLabs needed: Veo 3.1 generates the voice natively from the quoted dialogue.

## Structure

```
public/index.html   the whole frontend
api/generate.js     POST: start a job (or ?wait=1 to block until done)
api/status.js       GET/POST: poll a job, auto-chains extensions
api/video.js        GET: proxies the Veo mp4 (Google needs the key)
api/health.js       GET: config check
lib/                gemini calls, setting prompts, stateless signed job tokens
```

No database. The job state lives in a signed token that the client passes back on every poll.

## API

```bash
# start
curl -X POST https://YOUR-APP.vercel.app/api/generate \
  -F photo=@me.jpg -F setting=fantasy -F idea="Announce my new agency" -F duration=8

# poll with the latest job token until status=done
curl "https://YOUR-APP.vercel.app/api/status?job=$JOB"

# or do it in one blocking call (≤ ~4.5 min)
curl -X POST "https://YOUR-APP.vercel.app/api/generate?wait=1" \
  -H "Content-Type: application/json" \
  -d '{"photoUrl":"https://.../me.jpg","setting":"ugc","idea":"...","duration":8}'
```

| field | values |
|---|---|
| `photo` | file (multipart), base64, or data URL, **or** `photoUrl` |
| `setting` | `ugc` `office` `fantasy` `cyberpunk` `podcast` `noir` |
| `idea` | free-text script idea |
| `duration` | `4` `6` `8` `15` `22` `29` (seconds) |
| `aspect` | optional `9:16` / `16:9` (default depends on setting) |

## Env

- `GEMINI_API_KEY`: required. Veo needs a billing-enabled key.
- `ACCESS_CODE`: optional. When set, requests must send it (`x-access-code` header or `accessCode` field). Set it so strangers can't spend your Veo credits.
- `SCRIPT_MODEL`, `IMAGE_MODEL`, `VIDEO_MODEL`: optional model overrides.

## Local

```bash
GEMINI_API_KEY=... node dev.js   # http://localhost:3000
```
