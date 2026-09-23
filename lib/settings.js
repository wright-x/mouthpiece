// Each setting routes to its own avatar style, scene direction, audio bed and default framing.
export const SETTINGS = {
  ugc: {
    label: "UGC",
    aspect: "9:16",
    avatar:
      "Casual selfie-style portrait taken on a phone front camera, natural window light, cozy apartment or bedroom background slightly out of focus, relaxed everyday outfit, authentic and unpolished, looking straight into the lens.",
    scene:
      "Handheld vertical selfie video in the style of a TikTok / Instagram creator. Slight natural hand shake, natural daylight, authentic, casual and energetic.",
    camera: "handheld front-camera selfie framing, subtle movement",
    ambience: "quiet room tone",
    voice: "casual, upbeat, conversational creator voice",
  },
  office: {
    label: "Office",
    aspect: "16:9",
    avatar:
      "Professional corporate headshot, smart business-casual outfit, modern glass-walled office with soft bokeh, clean even studio lighting, confident friendly expression, looking into the camera.",
    scene:
      "Polished corporate video in a bright modern office. Soft key light, shallow depth of field, calm and professional.",
    camera: "locked-off medium close-up on a tripod",
    ambience: "soft office ambience, faint keyboard clicks",
    voice: "clear, confident, professional presenter voice",
  },
  fantasy: {
    label: "Fantasy",
    aspect: "16:9",
    avatar:
      "Epic high-fantasy portrait: the same person reimagined as a heroic adventurer in ornate leather and cloak, glowing magical runes in the air, ancient enchanted forest with golden god-rays, painterly cinematic lighting, still clearly recognizable as the same person.",
    scene:
      "Cinematic high-fantasy scene with drifting magical particles and warm volumetric light through ancient trees.",
    camera: "slow cinematic push-in, medium close-up",
    ambience: "wind through leaves, distant birds, faint magical shimmer",
    voice: "dramatic, storytelling narrator voice",
  },
  cyberpunk: {
    label: "Cyberpunk",
    aspect: "16:9",
    avatar:
      "Cyberpunk portrait at night: the same person in a sleek techwear jacket, rain-soaked neon street, magenta and cyan signage reflections on skin, cinematic moody lighting, still clearly recognizable as the same person.",
    scene:
      "Rainy neon-lit cyberpunk street at night, reflections on wet surfaces, moody cinematic atmosphere.",
    camera: "slow dolly-in, medium close-up, anamorphic look",
    ambience: "light rain, distant city hum, faint synth drone",
    voice: "cool, low, confident voice",
  },
  podcast: {
    label: "Podcast",
    aspect: "16:9",
    avatar:
      "Podcast studio portrait: the same person seated at a desk with a professional broadcast microphone on a boom arm, acoustic foam panels and warm practical lamps behind, headphones around the neck, warm cinematic lighting.",
    scene:
      "Warm, intimate podcast studio with practical lamps and a broadcast microphone in frame.",
    camera: "static medium shot, slightly off-center",
    ambience: "intimate studio room tone",
    voice: "warm, relaxed, podcast-host voice speaking close to the mic",
  },
  noir: {
    label: "Noir",
    aspect: "16:9",
    avatar:
      "1940s film-noir portrait in black and white: the same person in a trench coat and fedora, venetian-blind shadows across the face, cigarette-smoke haze, high-contrast dramatic lighting.",
    scene:
      "Black-and-white 1940s film noir, hard light through venetian blinds, smoky haze, high contrast.",
    camera: "slow push-in, low-key lighting, medium close-up",
    ambience: "distant rain, a ticking clock",
    voice: "gravelly, hard-boiled detective narrator voice",
  },
};

// 8s = one Veo clip. 15s = 8s clip + one ~7s extension.
export const DURATIONS = [8, 15];

export function segmentPlan(duration) {
  const d = DURATIONS.includes(Number(duration)) ? Number(duration) : 8;
  if (d <= 8) return [d];
  const ext = Math.round((d - 8) / 7);
  return [8, ...Array(ext).fill(7)];
}
