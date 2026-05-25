/**
 * Audio Feedback Utility for Workout Alerts
 *
 * Uses the Web Audio API for low-latency playback that cuts through
 * background music (e.g. Spotify). Falls back gracefully when the API
 * is unavailable.
 */

// ---------------------------------------------------------------------------
// Singleton AudioContext (created lazily on first user gesture)
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (ctx && ctx.state !== "closed") return ctx;
  try {
    // Safari < 14 only exposes `webkitAudioContext`. Narrow safely.
    const W = window as typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = W.AudioContext ?? W.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Resume the AudioContext after a user gesture.
 * Call this once early (e.g. on first tap in the workout player)
 * so subsequent plays aren't blocked by autoplay policy.
 */
function unlockAudio(): void {
  const c = getAudioContext();
  if (!c) return;
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }

  // Request notification permission on user gesture (browser policy)
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }

  // Silent warm-up oscillator — keeps iOS audio daemon engaged
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    gain.gain.value = 0; // completely silent
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.1);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Synthesised beep (no external file needed)
// ---------------------------------------------------------------------------

interface BeepOptions {
  /** Frequency in Hz (default 880 — A5, a sharp attention-grabbing tone) */
  frequency?: number;
  /** Duration in seconds (default 0.15) */
  duration?: number;
  /** 0-1 volume (default 0.6) */
  volume?: number;
  /** Number of rapid beeps (default 3) */
  count?: number;
  /** Gap between beeps in seconds (default 0.1) */
  gap?: number;
}

/**
 * Play a synthesised beep sequence via Web Audio API.
 * Designed to cut through Spotify / background audio.
 */
function playBeep(opts: BeepOptions = {}): void {
  const { frequency = 880, duration = 0.12, volume = 0.6, count = 3, gap = 0.1 } = opts;

  const c = getAudioContext();
  if (!c) return;

  // Make sure context is running
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }

  const now = c.currentTime;
  const masterGain = c.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(c.destination);

  for (let i = 0; i < count; i++) {
    const start = now + i * (duration + gap);

    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.value = frequency;

    // Per-beep envelope for a clean click
    const env = c.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(1, start + 0.005);
    env.gain.setValueAtTime(1, start + duration - 0.01);
    env.gain.linearRampToValueAtTime(0, start + duration);

    osc.connect(env);
    env.connect(masterGain);

    osc.start(start);
    osc.stop(start + duration + 0.01);
  }
}

// ---------------------------------------------------------------------------
// Haptic + Audio combined helpers
// ---------------------------------------------------------------------------

/**
 * Fire both haptic vibration and an audible beep.
 * Ideal for rest-timer-end alerts.
 */
export function alertRestTimerEnd(): void {
  // Haptic: two sharp bursts
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      // ignore
    }
  }

  // Audio: triple beep
  playBeep({ frequency: 880, count: 3, duration: 0.12, gap: 0.1, volume: 0.6 });
}

/**
 * A gentler single tick for countdown warnings (e.g. 3-2-1).
 */
function tickSound(): void {
  playBeep({ frequency: 660, count: 1, duration: 0.06, volume: 0.3 });
}
