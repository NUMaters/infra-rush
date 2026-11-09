import { describe, expect, it, vi } from "vitest";
import { Sound } from "../src/ui/audio";

function titleSound(playing: boolean, muted = false) {
  const sound = new Sound();
  sound.muted = muted;
  const music = {
    paused: !playing,
    pause: vi.fn(function (this: { paused: boolean }) {
      this.paused = true;
    }),
    play: vi.fn(function (this: { paused: boolean }) {
      this.paused = false;
      return Promise.resolve();
    }),
  };
  Object.assign(sound, {
    scene: "title",
    tracks: new Map([["title", { music }]]),
  });
  return { sound, music };
}

describe("intro movie music handoff", () => {
  it("unlocks the audio context even when the media element already reports playing", () => {
    const { sound, music } = titleSound(true);
    const unlock = vi.spyOn(sound, "unlock").mockImplementation(() => {});
    sound.resumeMusic();
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(music.play).not.toHaveBeenCalled();
  });
  it("pauses playing music, blocks gesture resumes, then restores it only once", () => {
    const { sound, music } = titleSound(true);
    const restore = sound.suspendMusic();
    expect(music.paused).toBe(true);
    sound.resumeMusic();
    expect(music.play).not.toHaveBeenCalled();
    restore();
    restore();
    expect(music.play).toHaveBeenCalledTimes(1);
    expect(sound.muted).toBe(false);
  });
  it("preserves a muted user's preference", () => {
    const { sound, music } = titleSound(true, true);
    const restore = sound.suspendMusic();
    expect(sound.muted).toBe(true);
    restore();
    expect(sound.muted).toBe(true);
    expect(music.play).toHaveBeenCalledTimes(1);
  });
  it("does not start music that was paused or blocked by autoplay", () => {
    const { sound, music } = titleSound(false);
    sound.suspendMusic()();
    expect(music.play).not.toHaveBeenCalled();
  });
  it("does not resume an old scene", () => {
    const { sound, music } = titleSound(true);
    const restore = sound.suspendMusic();
    Object.assign(sound, { scene: "game" });
    restore();
    expect(music.play).not.toHaveBeenCalled();
  });
});
