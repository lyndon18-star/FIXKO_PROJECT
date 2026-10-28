/**
 * Fixko UI sound feedback — synthesized with Web Audio (no audio files).
 * Sounds only fire for genuinely interactive controls via the delegated
 * listener; plain buttons stay silent.
 */

export type SoundName =
  | "tick" // chips, tabs, pagination, page dots
  | "success" // confirm / submit actions
  | "danger" // delete / remove
  | "warn" // suspend / lock / flag
  | "dismiss"; // close / cancel

// Keeps one shared Web Audio player so we don't create a new one for every click.
let ctx: AudioContext | null = null;

// Gets (or creates) the browser's audio player. Returns null if audio isn't available.
function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

type ToneOptions = {
  from: number;
  to: number;
  duration: number;
  delay?: number;
  type?: OscillatorType;
  gain?: number;
};

// Plays one short beep: a note sliding from `from` to `to` Hz over `duration` seconds.
function tone(options: ToneOptions) {
  const audio = getCtx();
  if (!audio) return;
  const { from, to, duration, delay = 0, type = "sine", gain = 0.05 } = options;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const vol = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
  vol.gain.setValueAtTime(0, start);
  vol.gain.linearRampToValueAtTime(gain, start + 0.006);
  vol.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(vol).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

// This plays the named UI sound. Each sound is 1-2 quick tones that match the mood
// (a chirp for ticks, a rising pair for success, a low drop for danger, etc.).
export function playSound(name: SoundName) {
  switch (name) {
    case "tick":
      tone({ from: 1250, to: 900, duration: 0.07, type: "triangle", gain: 0.035 });
      break;
    case "success":
      tone({ from: 660, to: 660, duration: 0.09, gain: 0.05 });
      tone({ from: 990, to: 990, duration: 0.14, delay: 0.08, gain: 0.05 });
      break;
    case "danger":
      tone({ from: 340, to: 140, duration: 0.22, type: "sawtooth", gain: 0.05 });
      break;
    case "warn":
      tone({ from: 480, to: 480, duration: 0.1, type: "square", gain: 0.032 });
      tone({ from: 400, to: 400, duration: 0.16, delay: 0.11, type: "square", gain: 0.032 });
      break;
    case "dismiss":
      tone({ from: 520, to: 320, duration: 0.11, type: "sine", gain: 0.04 });
      break;
  }
}

/** CSS selectors → sound, checked in priority order. First match wins. */
const SOUND_RULES: Array<[SoundName, string]> = [
  ["danger", ".users-menu-delete, .report-mod-remove, .recycle-bin-purge"],
  [
    "warn",
    ".users-menu-suspend, .users-menu-lock, .users-menu-warn, .report-mod-flag",
  ],
  [
    "success",
    ".confirm-modal-ok, .report-mod-confirm, .report-modal-submit, .recycle-bin-restore",
  ],
  ["dismiss", ".confirm-modal-cancel, .report-modal-close"],
  [
    "tick",
    ".notifications-chip, .notifications-page-btn, .notifications-page-dot, " +
      ".notifications-more-toggle, .report-mod-choice, .users-menu-item, " +
      ".notice-modal-ok, .done-works-row, .admin-text-action",
  ],
];

// Looks at what was clicked and decides which sound (if any) it should play.
function resolveSound(target: EventTarget | null): SoundName | null {
  const element =
    target instanceof Element
      ? target.closest<HTMLElement>("button, [role='menuitem']")
      : null;
  if (!element || element.hasAttribute("disabled")) return null;
  for (const [sound, selector] of SOUND_RULES) {
    if (element.matches(selector)) return sound;
  }
  return null;
}

/** Install a single delegated click listener. Returns a cleanup function. */
export function initSoundFeedback(): () => void {
  const onClick = (event: MouseEvent) => {
    const sound = resolveSound(event.target);
    if (sound) playSound(sound);
  };
  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}
