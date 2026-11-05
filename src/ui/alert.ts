let ctx: AudioContext | null = null;

/** Short beep + vibration to signal the end of a rest period. */
export function restAlert(sound: boolean): void {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Vibration unsupported.
  }
  if (!sound) return;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Audio unavailable (e.g. autoplay policy); vibration is enough.
  }
}
