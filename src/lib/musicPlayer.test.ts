import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMusicPlayer, type MusicAudio } from "./musicPlayer";

class FakeDoc extends EventTarget {
  visibilityState = "visible";
  listeners = 0;
  override addEventListener(t: string, l: EventListenerOrEventListenerObject | null) {
    this.listeners += 1;
    super.addEventListener(t, l);
  }
  override removeEventListener(t: string, l: EventListenerOrEventListenerObject | null) {
    this.listeners -= 1;
    super.removeEventListener(t, l);
  }
}

function fakeAudio(playImpl: () => Promise<void> = () => Promise.resolve()) {
  const audio = {
    loop: false,
    volume: 1,
    preload: "none",
    paused: true,
    play: vi.fn(() => {
      audio.paused = false;
      return playImpl();
    }),
    pause: vi.fn(() => {
      audio.paused = true;
    }),
    removeAttribute: vi.fn(),
    load: vi.fn(),
  };
  return audio satisfies MusicAudio;
}

let doc: FakeDoc;
beforeEach(() => {
  vi.useFakeTimers();
  doc = new FakeDoc();
});
afterEach(() => vi.useRealTimers());

function setup(playImpl?: () => Promise<void>) {
  const audio = fakeAudio(playImpl);
  const createAudio = vi.fn(() => audio);
  const player = createMusicPlayer("/m.ogg", { createAudio, doc });
  player.attach();
  return { audio, createAudio, player };
}

describe("createMusicPlayer", () => {
  it("creates audio lazily", () => {
    const { createAudio } = setup();
    expect(createAudio).not.toHaveBeenCalled();
  });

  it("fades in on enable and fades out then pauses on disable", () => {
    const { audio, player, createAudio } = setup();
    player.setEnabled(true);
    expect(createAudio).toHaveBeenCalledWith("/m.ogg");
    expect(audio.loop).toBe(true);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.volume).toBe(0);
    vi.advanceTimersByTime(500);
    expect(audio.volume).toBeGreaterThan(0);
    expect(audio.volume).toBeLessThan(0.22);
    vi.advanceTimersByTime(600);
    expect(audio.volume).toBeCloseTo(0.22);

    player.setEnabled(false);
    expect(audio.pause).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(audio.volume).toBe(0);
  });

  it("does not throw or reject when play() is rejected", async () => {
    const { player } = setup(() => Promise.reject(new DOMException("x", "NotSupportedError")));
    expect(() => player.setEnabled(true)).not.toThrow();
    await Promise.resolve();
    vi.advanceTimersByTime(2000);
  });

  it("does not throw when play() throws synchronously", () => {
    const audio = fakeAudio();
    audio.play.mockImplementation(() => {
      throw new Error("boom");
    });
    const player = createMusicPlayer("/m.ogg", { createAudio: () => audio, doc });
    expect(() => player.setEnabled(true)).not.toThrow();
  });

  it("survives a failing audio factory", () => {
    const player = createMusicPlayer("/m.ogg", {
      createAudio: () => {
        throw new Error("no Audio");
      },
      doc,
    });
    expect(() => player.setEnabled(true)).not.toThrow();
    expect(() => player.dispose()).not.toThrow();
  });

  it("defers start to the first gesture and removes the listeners afterwards", () => {
    const { audio, player } = setup();
    player.setEnabled(true, true);
    expect(audio.play).not.toHaveBeenCalled();
    doc.dispatchEvent(new Event("pointerdown"));
    expect(audio.play).toHaveBeenCalledTimes(1);
    doc.dispatchEvent(new Event("keydown"));
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(doc.listeners).toBe(1); // only visibilitychange remains
  });

  it("re-arms the gesture listener when autoplay is blocked", async () => {
    let first = true;
    const { audio, player } = setup(() => {
      if (first) {
        first = false;
        return Promise.reject(new DOMException("blocked", "NotAllowedError"));
      }
      return Promise.resolve();
    });
    player.setEnabled(true);
    await Promise.resolve();
    await Promise.resolve();
    doc.dispatchEvent(new Event("keydown"));
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it("pauses while hidden and resumes when visible if enabled", () => {
    const { audio, player } = setup();
    player.setEnabled(true);
    doc.visibilityState = "hidden";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(audio.pause).toHaveBeenCalledTimes(1);
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it("does not resume on visibility when disabled", () => {
    const { audio, player } = setup();
    player.setEnabled(true);
    player.setEnabled(false);
    vi.advanceTimersByTime(500);
    doc.visibilityState = "hidden";
    doc.dispatchEvent(new Event("visibilitychange"));
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("dispose pauses, releases src and removes every listener", () => {
    const { audio, player } = setup();
    player.setEnabled(true, true);
    player.dispose();
    expect(doc.listeners).toBe(0);
    player.setEnabled(true);
    player.dispose();
    const second = createMusicPlayer("/m.ogg", { createAudio: () => audio, doc });
    second.attach();
    second.setEnabled(true);
    second.dispose();
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.removeAttribute).toHaveBeenCalledWith("src");
    expect(doc.listeners).toBe(0);
  });
});
