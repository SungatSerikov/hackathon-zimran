import { useCallback, useEffect, useRef, useState } from "react";
import { safeRead, safeWrite } from "./storage";
import { createMusicPlayer, type MusicPlayer } from "./musicPlayer";

const MUSIC_URL = "/assets/music/jazz_improv_looped.mp3";

export type GameSound = "click" | "paper" | "pin" | "stamp" | "record";

/** Tiny original synthesized effects. Audio is opt-in and never required to play. */
export function useGameAudio() {
  const [enabled, setEnabled] = useState(
    () => safeRead<unknown>("case-desk:sound", false) === true,
  );
  const context = useRef<AudioContext | null>(null);
  const music = useRef<MusicPlayer | null>(null);
  const getMusic = () => (music.current ??= createMusicPlayer(MUSIC_URL));
  const play = useCallback(
    (kind: GameSound = "click", force = false) => {
      if ((!enabled && !force) || typeof AudioContext === "undefined") return;
      try {
        const ctx = context.current ?? (context.current = new AudioContext());
        void ctx.resume().catch(() => {});
        const now = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const notes = {
          click: [480, 240, 0.06],
          paper: [180, 70, 0.13],
          pin: [940, 360, 0.1],
          stamp: [100, 35, 0.2],
          record: [420, 840, 0.18],
        };
        const [start, end, duration] = notes[kind];
        oscillator.type =
          kind === "paper" || kind === "stamp" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(start, now);
        oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.065, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(now);
        oscillator.stop(now + duration + 0.01);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      } catch {
        /* Browser audio restrictions must not block the game. */
      }
    },
    [enabled],
  );
  useEffect(
    () => () => {
      void context.current?.close().catch(() => {});
      context.current = null;
    },
    [],
  );
  useEffect(() => {
    const player = getMusic();
    player.attach();
    // Sound restored as "on" has no user gesture yet: start on the first one.
    if (safeRead<unknown>("case-desk:sound", false) === true) {
      player.setEnabled(true, true);
    }
    return () => {
      player.dispose();
      music.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function toggle() {
    const next = !enabled;
    setEnabled(next);
    safeWrite("case-desk:sound", next);
    getMusic().setEnabled(next);
    if (next) play("record", true);
  }
  return { enabled, toggle, play };
}
