// Tiny WebAudio chime used for UI sound effects. No external assets.
let ctx: AudioContext | null = null;

export function playChime(frequency = 880, durationMs = 120) {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const c = ctx;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.08, c.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + durationMs / 1000);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + durationMs / 1000);
  } catch {
    // ignore — audio is best-effort
  }
}
