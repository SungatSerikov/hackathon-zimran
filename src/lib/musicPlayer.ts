/** Minimal slice of HTMLAudioElement the player needs (easy to fake in tests). */
export interface MusicAudio {
  loop: boolean;
  volume: number;
  preload: string;
  readonly paused: boolean;
  play(): Promise<void> | void;
  pause(): void;
  removeAttribute(name: string): void;
  load?(): void;
}

export interface MusicEvents {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  visibilityState?: string;
}

export interface MusicPlayerOptions {
  volume?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  createAudio?: (url: string) => MusicAudio;
  doc?: MusicEvents | null;
}

const GESTURES = ["pointerdown", "keydown"];
const STEP_MS = 50;

/**
 * Background music with fades, autoplay-policy handling and visibility pause.
 * Every failure is swallowed: music is optional and must never break the game.
 */
export function createMusicPlayer(url: string, options: MusicPlayerOptions = {}) {
  const volume = options.volume ?? 0.22;
  const fadeInMs = options.fadeInMs ?? 1000;
  const fadeOutMs = options.fadeOutMs ?? 400;
  const doc =
    options.doc === undefined
      ? typeof document === "undefined"
        ? null
        : (document as unknown as MusicEvents)
      : options.doc;
  const createAudio =
    options.createAudio ??
    ((src: string) => {
      const el = new Audio();
      el.preload = "none";
      el.src = src;
      return el as MusicAudio;
    });

  let audio: MusicAudio | null = null;
  let enabled = false;
  let attached = false;
  let armed = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const hidden = () => doc?.visibilityState === "hidden";

  function getAudio(): MusicAudio | null {
    if (audio) return audio;
    try {
      audio = createAudio(url);
      audio.loop = true;
      audio.volume = 0;
    } catch {
      audio = null;
    }
    return audio;
  }

  function clearFade() {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }

  function fadeTo(target: number, ms: number, done?: () => void) {
    clearFade();
    const el = audio;
    if (!el) return;
    const from = el.volume;
    const steps = Math.ceil(ms / STEP_MS);
    if (steps <= 0 || from === target) {
      el.volume = target;
      done?.();
      return;
    }
    let i = 0;
    timer = setInterval(() => {
      i += 1;
      try {
        if (i >= steps) {
          clearFade();
          el.volume = target;
          done?.();
        } else {
          el.volume = Math.min(1, Math.max(0, from + ((target - from) * i) / steps));
        }
      } catch {
        clearFade();
      }
    }, STEP_MS);
  }

  function safePause() {
    try {
      audio?.pause();
    } catch {
      /* ignore */
    }
  }

  function disarm() {
    if (!armed) return;
    armed = false;
    for (const type of GESTURES) doc?.removeEventListener(type, onGesture);
  }

  function arm() {
    if (armed || !doc) return;
    armed = true;
    for (const type of GESTURES) doc.addEventListener(type, onGesture);
  }

  function onGesture() {
    disarm();
    if (enabled) start();
  }

  function start() {
    if (!enabled || hidden()) return;
    const el = getAudio();
    if (!el) return;
    disarm();
    try {
      el.preload = "auto";
      const result = el.play();
      if (result && typeof result.then === "function") {
        result.then(
          () => {
            if (!enabled || hidden()) safePause();
          },
          (error: unknown) => {
            // Autoplay blocked: retry on the next user gesture. Other failures
            // (unsupported format, aborted load) are ignored for good.
            if ((error as { name?: string } | null)?.name === "NotAllowedError" && enabled) arm();
          },
        );
      }
      fadeTo(volume, fadeInMs);
    } catch {
      /* play() threw synchronously: stay silent */
    }
  }

  function onVisibility() {
    if (hidden()) {
      clearFade();
      safePause();
    } else if (enabled) {
      start();
    }
  }

  return {
    /** Start listening for tab visibility changes. */
    attach() {
      if (attached || !doc) return;
      attached = true;
      doc.addEventListener("visibilitychange", onVisibility);
    },
    /**
     * Turn music on/off. Pass `deferUntilGesture` when enabling without a user
     * gesture (e.g. restored from storage): playback starts on the first
     * pointerdown/keydown instead.
     */
    setEnabled(on: boolean, deferUntilGesture = false) {
      enabled = on;
      if (on) {
        if (deferUntilGesture) arm();
        else start();
      } else {
        disarm();
        if (audio) fadeTo(0, fadeOutMs, safePause);
      }
    },
    get enabled() {
      return enabled;
    },
    /** Pause, release the media resource and remove all listeners. */
    dispose() {
      clearFade();
      disarm();
      if (attached) doc?.removeEventListener("visibilitychange", onVisibility);
      attached = false;
      enabled = false;
      if (audio) {
        safePause();
        try {
          audio.removeAttribute("src");
          audio.load?.();
        } catch {
          /* ignore */
        }
        audio = null;
      }
    },
  };
}

export type MusicPlayer = ReturnType<typeof createMusicPlayer>;
